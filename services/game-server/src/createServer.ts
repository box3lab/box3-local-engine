import { ProjectBakeCache } from '@box/build-system/project/bake';
import { ApiClient, CreativeMode, ModelType } from '@box/apis';
import { PrebakeCache } from '@box/build-system/project/prebake-schema';
import { BuildSystemAPI } from '@box/build-system/type';
import { ContentServer } from '@box/content-server';
import { MuSystemScheduler } from '@box/mudb/scheduler/system';
import { MuServer } from '@box/mudb/server';
import { MuWebSocketServer } from '@box/mudb/socket/web/server';
import { DB } from '@box/schema/backend/database-type';
import type { GroupProjectStore } from '@box/schema/group-project/rda';
import type { ProjectAction } from '@box/schema/replica/replica-schema';
import { getMeshPath } from '@box/schema/project/hot-schema';
import { GameSessionData, UserDetailSchema } from '@box/schema/session/schema';
import {
  SchemaTraceEntry,
  traceProtocols,
  trapDoubleFree,
} from '@box/schema/utils/trace-schema';
import { bodyParse } from '@box/utils/backend';
import { EventBus } from '@box/utils/event';
import { getRealIP } from '@box/utils/ip';
import { Logger as LegacyLogger } from '@box/utils/logger';
import { freeVoxels } from '@box/utils/voxel';
import { verifyRuntimePlayerIdentity } from '@box/utils/local-player-identity';
import * as http from 'http';
import * as https from 'https';
import type { Logger } from 'pino';
import { randomUUID } from 'crypto';
import * as url from 'url';
import { type BackendSocket } from '../backendSocket';
import { ServerRuntimeConfig } from '../config/server';
import { BLOCK_INFO_RES } from './assets/block_info';
import { BackendClientRPCNode } from './backend-rpc-client-node';
import type { EditServer } from './edit/edit-server';
import type {
  LocalProjectModelAction,
  LocalProjectSkinAction,
} from './edit/replica/replica-server';
import { GameServer } from './index';
import { NetLogServer } from './net-log/server';
import { startPlayServer } from './play/play-server';
import type { RuntimeRedisStore } from './redis/runtime-redis';
import { getFakeUser } from './session/fake';
import { createBuiltInSkin } from './player/built-in-skins';
import { startPlayerRevocationPoller } from './player/player-revocation-poller';
import { GameSession } from './session/server';
import { ServerSettings } from './settings/server-settings-schema';
import { computeAudioPrefetch } from './sound/server-sound-controller';
import { MockSQL } from './storage/mock-storage';
import { SQLJS } from './storage/sqljs';
import { resolveGroupStorageNamespace } from './storage/storage-namespace';
import { CommonSQL } from './storage/types';
import { getHashFromContainerName } from './utils/container-name';
import { FrameskipsManager } from './utils/frameskips-manager';
import { rootLogger } from './utils/logger';
import { ScriptServer } from './utils/script-server/type';
import { parsePrebakeVoxelData } from './voxel/voxel-server';
import { expandVoxelMap, validateVoxelExpansionShape } from './voxel/voxel-expansion';
import {
  getLocalProjectModelPreviews,
  getLocalProjectModelProjects,
  getLocalProjectModelPaths,
  getLocalProjectSkinPreviews,
  getLocalProjectSkinProjects,
  syncLocalProjectModelPaths,
} from './project/local-project-state';
import {
  AsyncSingleFlight,
  findReusableProjectModel,
  projectModelNameFromPath,
} from './project/project-model-import';
import { isContentHash } from './project/content-hash';
import { voxaInternalHeaders } from './project/voxa-internal-auth';

export type HttpRoutes = {
  [route: string]: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => Promise<void>;
};

function localVoxaApi(baseUrl: string) {
  return new ApiClient({
    baseUrl,
    headers: voxaInternalHeaders(),
    defaultErrorMessage: 'VOXA request failed',
  });
}

async function storeVoxaBlob(api: ApiClient, hash: string, contentServer: ContentServer) {
  const result = await api.getApiLocalBlobsHashRaw({
    params: { path: { hash } },
    parseAs: 'arrayBuffer',
  });
  if (!result.response.ok || !(result.data instanceof ArrayBuffer)) {
    throw new Error(`VOXA model resource does not exist: ${hash}`);
  }
  const storedHash = await contentServer.store(new Uint8Array(result.data));
  if (storedHash !== hash) throw new Error(`model resource verification failed: ${hash}`);
}

// This session id is just used for identifying a socket, should not use cookie session id
function genSessionId() {
  return randomUUID();
}
function getLoginStr(x: string): 'guest' | 'user' | 'admin' | '' | 'cookie' {
  const result = x.toLowerCase();
  if (
    result === 'guest' ||
    result === 'user' ||
    result === 'admin' ||
    result === 'cookie'
  ) {
    return result;
  }
  return '';
}

export async function createGameServer(spec: {
  logger: Logger;
  legacyLogger: LegacyLogger;
  contentServer: ContentServer;
  ossContentServer: ContentServer;
  buildSystem: BuildSystemAPI;
  traces: SchemaTraceEntry[];
  brpc: BackendClientRPCNode;
  scriptServer: ScriptServer;
  prebake: PrebakeCache;
  httpRoutes: HttpRoutes;
  httpServer: http.Server | https.Server;
  httpEvent: EventBus<http.IncomingMessage>;
  frameskipsManager: FrameskipsManager;
  serverConfig: ServerRuntimeConfig;
  backendSocket: BackendSocket;
  pendingActions: ProjectAction[][];
  groupStore?: GroupProjectStore;
  businessRedis?: RuntimeRedisStore;
}) {
  const serverConfig = spec.serverConfig;
  const login = getLoginStr(serverConfig.login);
  // create mu server
  spec.logger.info('Creating MuServer...');
  const skipProtocolValidation =
    process.env.NODE_ENV !== 'development' && serverConfig.method !== 'local';
  const socketServer = new MuWebSocketServer({
    server: spec.httpServer,
    requireSessionProof: true,
    maxPayload: serverConfig.mode === 'edit' ? 16 * 1024 * 1024 : 1024 * 1024,
    // TODO 改用 debug
  });
  const muServer = new MuServer(
    socketServer,
    void 0, // TODO 改用 debug
    skipProtocolValidation,
  );

  // set up logging protocol
  const netLog = new NetLogServer({
    server: muServer,
    sink: spec.legacyLogger.sink,
    logger: spec.logger,
  });

  // set up sql stuff
  let sql: CommonSQL = new MockSQL();
  switch (serverConfig.storageMode.toLowerCase()) {
    case 'sqlite':
      spec.logger.warn('Using deprecated sqlite3 database.');
      break;
    case 'sqljs':
      sql = new SQLJS();
      await (<SQLJS>sql).init(serverConfig.CDN_PATH);
      break;
    default:
      // do nothing if using mock database
      break;
  }

  const brpc = spec.brpc;

  // set up session server
  const sessionService = new GameSession(
    spec.legacyLogger.create('session'),
    serverConfig.method === 'local',
    Math.max(5_000, serverConfig.sessionTtlMs),
    spec.businessRedis,
    resolveGroupStorageNamespace(serverConfig),
  );

  // create the game server
  let editServer: EditServer | undefined;
  let game: GameServer;
  const voxels = parsePrebakeVoxelData(
    spec.prebake.coldProject.voxels,
    spec.prebake.voxelBytes,
  );

  // game state上存储的一份配置
  const serverSettings: ServerSettings = {
    // script safety limits
    scriptTimeout: serverConfig.scriptTimeout,
    scriptHeapSizeMB: serverConfig.scriptHeapSizeMB,
    // script api world.url
    gameURL: [
      serverConfig.ARENA_URL,
      serverConfig.mode === 'edit' ? 'e' : 'p',
      getHashFromContainerName(serverConfig.containerName),
    ].join('/'),
    mode: serverConfig.mode,
    env: serverConfig.env,
    playerLimit: serverConfig.playerLimit,
    autoSaveInterval: serverConfig.autoSaveInterval,
    containerName: serverConfig.containerName,
    containerType: serverConfig.containerType,
    teamId: serverConfig.teamId,
    groupId: serverConfig.groupId,
    contentId: serverConfig.contentId,
    serverId: serverConfig.serverId,
    zeroPlayerTimeout: serverConfig.maxZeroPlayerTime,
    permissionTokenSecret: serverConfig.permissionTokenSecret,

    // database limits
    sqlLiteHeapQuota: serverConfig.sqlLiteHeapQuota,
    dbSizeLimit: serverConfig.dbSizeLimit,
    dbChunkSize: serverConfig.dbChunkSize,

    debug: serverConfig.debug,
    teleportAccess: serverConfig.teleportAccess,
    paidAccess: serverConfig.paidAccess,
  };
  if (serverConfig.mode === 'edit') {
    const { startEditServer } = await import('./edit/edit-server');
    editServer = await startEditServer({
      server: muServer,
      scheduler: MuSystemScheduler,
      buildSystem: spec.buildSystem,
      bake: new ProjectBakeCache(
        spec.contentServer,
        spec.buildSystem,
        BLOCK_INFO_RES.blockInfo,
      ),
      contentServer: spec.contentServer,
      ossContentServer: spec.ossContentServer,
      scriptServer: spec.scriptServer,
      logger: spec.logger,
      legacyLogger: spec.legacyLogger,
      session: sessionService,
      projectHash: spec.prebake.projectHash,
      project: spec.prebake.coldProject,
      extraProject: spec.prebake.extraProjectInfo,
      hotProject: spec.prebake.hotProject,
      settings: serverSettings,
      permissionHash: spec.prebake.permissionsHash,
      permissions: spec.prebake.permissions,
      sql,
      voxels,
      brpc,
      contentId: serverConfig.contentId,
      backendSocket: spec.backendSocket,
      pendingActions: spec.pendingActions,
      groupStore: spec.groupStore,
    });
    game = editServer.state.game;
  } else {
    const playServer = await startPlayServer({
      server: muServer,
      scheduler: MuSystemScheduler,
      contentServer: spec.contentServer,
      ossContentServer: spec.ossContentServer,
      scriptServer: spec.scriptServer,
      logger: spec.logger,
      legacyLogger: spec.legacyLogger,
      session: sessionService,
      hotProject: spec.prebake.hotProject,
      voxel: voxels,
      settings: serverSettings,
      sql,
      brpc,
      backendSocket: spec.backendSocket,
      featureFlags: serverConfig.FEATURE_FLAGS || [],
    });
    game = playServer.state.game;
  }

  startPlayerRevocationPoller(game, spec.logger);

  // install game traces
  if (serverConfig.traceAlloc || serverConfig.traceDoubleFree) {
    spec.logger.debug('Installing game specific traces');
    const traceStart = spec.traces.length;
    traceProtocols(spec.traces, muServer);
    traceProtocols(spec.traces, game.script.muServer);
    if (serverConfig.traceDoubleFree) {
      trapDoubleFree(spec.traces.slice(traceStart));
    }
  }

  async function initUserData(
    ipAddress: string,
    reqUrl: string,
    cookie: string,
    fingerPrint: string,
    token: string,
    host: string,
  ) {
    function redirect(location: string) {
      return { redirect: location };
    }
    // check IP address ban first
    if (game.state.bannedIP[ipAddress]) {
      spec.logger.info(
        `Banned ip address ${ipAddress}, sending to ${serverConfig.banRedirect} for punishment`,
      );
      return redirect(serverConfig.banRedirect);
    }

    // resolve session data for user
    let sessionData: GameSessionData;
    let userData: GameSessionData['user'];
    let deviceHash = '';
    if (login === 'admin') {
      // fake admin login
      const adminId = (Math.random() * 99999) | 0;
      const adminName = 'admin' + adminId;
      spec.logger.info('Creating fake admin account = ' + adminId);
      userData = getFakeUser(adminName, adminId);
      userData.permission |= DB.UserPermission.gameAdmin;
    } else if (serverConfig.method === 'local') {
      const usesPlayerService = Boolean(process.env.BOX_PLAYER_SERVICE_INTERNAL_URL);
      const requiresPlayerService = Boolean(process.env.BOX_DEPLOYMENT_MODE);
      const runtimeIdentity = usesPlayerService
        ? verifyRuntimePlayerIdentity(
            token,
            process.env.PERMISSION_TOKEN_SECRET || '',
          )
        : null;
      // A released Creator/Play deployment must never silently replace a
      // missing login service with the legacy shared local-player account.
      // That fallback is retained only for direct source-runtime development,
      // where BOX_DEPLOYMENT_MODE is intentionally absent.
      if (requiresPlayerService && !usesPlayerService) {
        throw new Error('Player Service identity is required for deployed local games');
      }
      if (usesPlayerService && !runtimeIdentity) {
        throw new Error('Invalid or expired local player identity');
      }
      if (runtimeIdentity) {
        if (runtimeIdentity.status === 'banned') {
          throw new Error('Local player is banned');
        }
        userData = UserDetailSchema.alloc();
        userData.id = runtimeIdentity.userId;
        userData.displayname = runtimeIdentity.displayName;
        // Boxes exposes the legacy Box account identifier through the engine
        // user's username field, which is then bound to entity.player.boxId.
        // Keep the local login username separate from this compatibility ID.
        userData.username = runtimeIdentity.boxId;
        userData.userKey = runtimeIdentity.userKey;
        userData.avatar_hash = runtimeIdentity.avatar;
        userData.wearing_skins = createBuiltInSkin(runtimeIdentity.avatarSkinId) || userData.wearing_skins;
        // A registered account editing a local project needs the same engine
        // privileges the old fake-admin shortcut supplied, while retaining
        // its real player id, name and stable user key.
        if (runtimeIdentity.role === 'admin' || editServer) {
          userData.permission |= DB.UserPermission.gameAdmin;
        }
        fingerPrint = runtimeIdentity.subjectId;
        deviceHash = runtimeIdentity.deviceHash || "";
        spec.logger.info(
          `Local ${runtimeIdentity.userId ? 'user' : 'guest'} log in: ${runtimeIdentity.displayName}`,
        );
      } else {
        const localPlayerName =
          process.env.BOX_LOCAL_PLAYER_NAME?.trim() || '本地玩家';
        const configuredId = Number(process.env.BOX_LOCAL_PLAYER_ID || '10000001');
        const localPlayerId =
          Number.isSafeInteger(configuredId) && configuredId > 0
            ? configuredId
            : 10000001;
        spec.logger.info(`Local player log in: ${localPlayerName} (${localPlayerId})`);
        userData = getFakeUser(localPlayerName, localPlayerId);
      }
    } else {
      spec.logger.info(`Guest log in.`);
      userData = getFakeUser('guest');
    }

    // editor specific authentication
    if (editServer) {
      // check for permission token
      if (reqUrl) {
        const query = url.parse(reqUrl, true).query;
        if (query.p && userData.id) {
          spec.logger.info('editor: redeeming query token');
          await editServer.replica.redeemToken(userData.id, '' + query.p);
        }
      }

      if (userData.permission & DB.UserPermission.gameAdmin) {
        // check for game admin overide
        spec.logger.info('editor: admin access');
        editServer.state.replica.adminUsers[userData.id] = true;
      }
    }

    // bind session token
    const sessionId = genSessionId();
    sessionData = await sessionService.bindUserSession(
      userData,
      ipAddress,
      sessionId,
      reqUrl,
      fingerPrint,
      'CN',
      deviceHash,
    );

    // prepare user configuration
    const admin = sessionData.isAdmin || login === 'admin';
    let prefetchHashes = await game.prefetch();

    const audioPrefetch = computeAudioPrefetch(game.state);

    prefetchHashes = prefetchHashes.concat(audioPrefetch.notConfigured);

    const config = {
      sessionId: sessionData.sessionId,
      sessionProof: socketServer.issueSessionProof(sessionData.sessionId),
      admin,
      maxSockets: 3,
      contentId: serverConfig.contentId,
      prefetchHashes,
      configuredAudioHashes: audioPrefetch.configured,
    };
    spec.logger.debug(
      `${admin ? 'admin' : 'user'} ${sessionData.sessionId} data fetched`,
    );

    return {
      data: config,
    };
  }
  const getHeader = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const setPublicCors = (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Auth',
    );
    res.setHeader('Vary', 'Origin');
  };

  const getPublicServerURL = (req: http.IncomingMessage) => {
    const configured = serverConfig.serverPublicUrl;
    if (configured) {
      return configured.replace(/\/$/, '');
    }
    const host = serverConfig.trustProxy
      ? getHeader(req.headers['x-forwarded-host']) || req.headers.host || ''
      : req.headers.host || '';
    const forwardedProtocol = serverConfig.trustProxy
      ? getHeader(req.headers['x-forwarded-proto'])
      : undefined;
    const protocol =
      forwardedProtocol === 'https' || forwardedProtocol === 'http'
        ? forwardedProtocol
        : serverConfig.isHttps
          ? 'https'
          : 'http';
    return `${protocol}://${host}`;
  };

  const createSession = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    direct: boolean,
  ): Promise<void> => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (direct) {
      setPublicCors(req, res);
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('method not allowed');
      return;
    }

    if (
      !direct &&
      serverConfig.BACKEND_AUTH_CODE &&
      req.headers.authorization !== serverConfig.BACKEND_AUTH_CODE
    ) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }

    const body = await bodyParse(req);
    const requestIP = direct
      ? getRealIP(req, serverConfig.trustProxy) || ''
      : body.ip || getRealIP(req, false) || '';
    if (
      !(await sessionService.allowSessionAttempt(
        requestIP || 'unknown',
        serverConfig.sessionRateLimitPerMinute,
      ))
    ) {
      res.writeHead(429, { 'Retry-After': '60' });
      res.end('too many session requests');
      return;
    }
    const host = serverConfig.trustProxy
      ? getHeader(req.headers['x-forwarded-host']) || req.headers.host || ''
      : req.headers.host || '';
    const result = await initUserData(
      requestIP,
      body.reqUrl || req.headers.origin || '',
      body.cookie || '',
      body.fingerPrint || '',
      body.auth || '',
      host,
    );

    res.setHeader('Content-Type', 'application/json');
    if (direct && 'data' in result) {
      const publicServerURL = getPublicServerURL(req);
      const socketServerUrl = publicServerURL.replace(/^http/, 'ws');
      res.end(
        JSON.stringify({
          config: {
            ...result.data,
            socketServerUrl,
          },
        }),
      );
      return;
    }
    res.end(JSON.stringify(result));
  };

  spec.httpRoutes['/createSession'] = (req, res) =>
    createSession(req, res, false);

  // Publishing from the local Creator must not race the editor's autosave
  // interval. This route is intentionally loopback-only: the Next.js Creator
  // process asks the active edit runtime to persist its current replica before
  // project-manager reads project-state.json and builds an immutable release.
  if (serverConfig.method === 'local' && serverConfig.mode === 'edit' && editServer) {
    const localOnly = (req: http.IncomingMessage, res: http.ServerResponse) => {
      const address = req.socket.remoteAddress || '';
      const allowed = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
      if (!allowed) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'forbidden' }));
      }
      return allowed;
    };

    spec.httpRoutes['/internal/creator-preview-runtime'] = async (req, res) => {
      if (!localOnly(req, res)) return;
      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(editServer.creatorPreviewRuntime.status()));
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'GET, POST' });
        res.end();
        return;
      }
      try {
        const body = await bodyParse(req) as { action?: unknown };
        const action = body.action;
        if (action !== 'start' && action !== 'stop') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'action 必须为 start 或 stop' }));
          return;
        }
        const status = action === 'start'
          ? await editServer.creatorPreviewRuntime.start()
          : await editServer.creatorPreviewRuntime.stop();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(status));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : String(error) }));
      }
    };

    spec.httpRoutes['/internal/creator-preview-runtime/events'] = async (req, res) => {
      if (!localOnly(req, res)) return;
      if (req.method !== 'GET') {
        res.writeHead(405, { Allow: 'GET' });
        res.end();
        return;
      }
      await editServer.creatorPreviewRuntime.subscribe(req, res);
    };

    spec.httpRoutes['/internal/save-local-project'] = async (req, res) => {
      const remoteAddress = req.socket.remoteAddress || '';
      const isLoopback =
        remoteAddress === '127.0.0.1' ||
        remoteAddress === '::1' ||
        remoteAddress === '::ffff:127.0.0.1';
      if (!isLoopback) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'POST' });
        res.end('method not allowed');
        return;
      }
      try {
        const permissionHash = await editServer.replica.saveProject();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ permissionHash }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: (error as Error).message }));
      }
    };

    spec.httpRoutes['/internal/validate-local-project-expansion'] = async (req, res) => {
      if (!localOnly(req, res)) return;
      if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'POST' });
        res.end('method not allowed');
        return;
      }
      try {
        const body = await bodyParse(req) as {
          shape?: { x?: unknown; y?: unknown; z?: unknown };
        };
        const shape = body.shape;
        if (
          !shape ||
          typeof shape.x !== 'number' ||
          typeof shape.y !== 'number' ||
          typeof shape.z !== 'number'
        ) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: '请提供有效的目标地图尺寸。' }));
          return;
        }
        const game = editServer.state.game;
        if (game.state.replica.running) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: '请先停止正在运行的地图，再执行扩容。' }));
          return;
        }
        const current = game.state.voxels;
        const alreadyExpanded =
          current.shape[0] === shape.x &&
          current.shape[1] === shape.y &&
          current.shape[2] === shape.z;
        if (!alreadyExpanded) {
          validateVoxelExpansionShape(current.shape, [shape.x, shape.y, shape.z]);
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ alreadyExpanded }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: error instanceof Error ? error.message : String(error),
        }));
      }
    };

    spec.httpRoutes['/internal/expand-local-project'] = async (req, res) => {
      if (!localOnly(req, res)) return;
      if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'POST' });
        res.end('method not allowed');
        return;
      }
      let expanded: ReturnType<typeof expandVoxelMap> | undefined;
      try {
        const body = await bodyParse(req) as {
          shape?: { x?: unknown; y?: unknown; z?: unknown };
        };
        const shape = body.shape;
        if (
          !shape ||
          typeof shape.x !== 'number' ||
          typeof shape.y !== 'number' ||
          typeof shape.z !== 'number'
        ) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: '请提供有效的目标地图尺寸。' }));
          return;
        }
        const game = editServer.state.game;
        if (game.state.replica.running) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: '请先停止正在运行的地图，再执行扩容。' }));
          return;
        }
        const current = game.state.voxels;
        if (
          current.shape[0] === shape.x &&
          current.shape[1] === shape.y &&
          current.shape[2] === shape.z
        ) {
          const permissionHash = await editServer.replica.saveProject();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            shape,
            permissionHash,
            alreadyExpanded: true,
          }));
          return;
        }
        try {
          validateVoxelExpansionShape(current.shape, [shape.x, shape.y, shape.z]);
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: error instanceof Error ? error.message : String(error) }));
          return;
        }
        expanded = expandVoxelMap(current, [shape.x, shape.y, shape.z]);
        const success = await game.voxel.reset(expanded);
        if (!success) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: '地图正在重置，请稍后重试。' }));
          return;
        }
        const permissionHash = await editServer.replica.saveProject();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          shape: { x: shape.x, y: shape.y, z: shape.z },
          permissionHash,
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: error instanceof Error ? error.message : String(error) }));
      } finally {
        if (expanded) {
          freeVoxels(expanded);
        }
      }
    };

    // Boxes treats extraProject as the map group's shared project library. The
    // local adapter keeps the same membership semantics by registering each
    // map's referenced meshes when its runtime becomes ready; the group view
    // is the union of all member registrations.
    syncLocalProjectModelPaths(
      Object.values(editServer.state.replica.project.entitiesTree).flatMap(
        (node) => {
          const mesh = node.value?.mesh;
          return typeof mesh === 'string' && mesh ? [mesh] : [];
        },
      ),
    );
    const localModelImports = new AsyncSingleFlight<
      number,
      Record<string, unknown>
    >();

    spec.httpRoutes['/api/project-models'] = async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET') {
        res.end(JSON.stringify({
          modelPreviews: getLocalProjectModelPreviews(),
          modelProjects: getLocalProjectModelProjects(),
          projectModelPaths: getLocalProjectModelPaths(),
        }));
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'GET, POST' });
        res.end(JSON.stringify({ message: 'method not allowed' }));
        return;
      }
      try {
        const body = await bodyParse(req) as Record<string, unknown>;
        const action = String(body.action || '');
        const name = String(body.name || '').trim();
        const requestedPath = String(body.meshPath || '').trim();
        if (
          action !== 'importLocal' &&
          !name &&
          !requestedPath
        ) throw new Error('model name or path is required');
        const voxaURL = (
          process.env.VOXA_INTERNAL_URL ||
          process.env.VOXA_URL ||
          'http://127.0.0.1:3001'
        ).replace(/\/$/, '');
        const voxaApi = localVoxaApi(voxaURL);
        if (action === 'importLocal') {
          const modelId = Number(body.modelId || 0);
          if (!Number.isSafeInteger(modelId) || modelId <= 0) {
            throw new Error('local model id is required');
          }
          const result = await localModelImports.run(modelId, async () => {
            const model = await voxaApi.getApiLocalModelsId({
              params: { path: { id: String(modelId) } },
            }) as Record<string, unknown>;
            const modelFileHash = String(model.modelFileHash || '');
            const previewHash = String(model.modelPreviewHash || '');
            const projectFileHash = String(model.projectFileHash || '');
            const meshAssets =
              editServer!.state.replica.extraProjectInfo.meshAssets;
            const reusable = findReusableProjectModel(
              meshAssets,
              modelFileHash,
            );
            if (reusable) {
              const [meshPath, asset] = reusable;
              return {
                modelId: asset.modelId,
                modelName: projectModelNameFromPath(meshPath),
                modelFileHash: asset.hash,
                modelPreviewHash: asset.modelPreviewHash,
                modelPreviewUrl: asset.modelPreviewHash
                  ? `/block/${asset.modelPreviewHash}`
                  : '',
                animated: asset.animated,
              };
            }

            for (const hash of [
              modelFileHash,
              previewHash,
              projectFileHash,
            ].filter(Boolean)) {
              await storeVoxaBlob(voxaApi, hash, spec.contentServer);
            }
            const baseName = String(
              model.modelName || `模型 ${modelId}`,
            ).trim();
            let modelName = baseName;
            let suffix = 2;
            while (meshAssets[getMeshPath(modelName)]) {
              modelName = `${baseName} (${suffix++})`;
            }
            // Project ids are independent from VOXA library ids. A timestamp
            // stays within JS safe integers and avoids cloud/local collisions.
            let projectModelId = Date.now();
            const usedIds = new Set(
              Object.values(meshAssets).map((asset) => asset.modelId),
            );
            while (usedIds.has(projectModelId)) projectModelId += 1;
            await editServer!.replica.updateLocalProjectModel({
              action: 'create',
              newName: modelName,
              modelId: projectModelId,
              modelFileHash,
              animated: Boolean(model.animated),
              previewHash,
              projectFileHash,
            });
            return {
              modelId: projectModelId,
              modelName,
              modelFileHash,
              modelPreviewHash: previewHash,
              modelPreviewUrl: previewHash ? `/block/${previewHash}` : '',
              animated: Boolean(model.animated),
            };
          });
          res.end(JSON.stringify(result));
          return;
        }
        if (
          action === 'rename' ||
          action === 'delete' ||
          action === 'restore' ||
          action === 'purge' ||
          action === 'update'
        ) {
          if (action === 'update') {
            const hashes = [
              String(body.modelFileHash || ''),
              String(body.previewHash || ''),
              String(body.projectFileHash || ''),
            ].filter(Boolean);
            if (!isContentHash(hashes[0])) throw new Error('model hash is invalid');
            for (const hash of hashes) {
              await storeVoxaBlob(voxaApi, hash, spec.contentServer);
            }
          }
          const result = await editServer!.replica.updateLocalProjectModel(
            body as LocalProjectModelAction,
          );
          res.end(JSON.stringify(result));
          return;
        }
        if (action !== 'prepareEdit') throw new Error('unsupported model action');
        const assetPath = requestedPath || getMeshPath(name);
        const asset = editServer!.state.replica.extraProjectInfo.meshAssets[assetPath];
        let projectFileHash = getLocalProjectModelProjects()[name];
        let sourceModel: Record<string, unknown> | undefined;
        const localIdMatch = assetPath.match(/__local_(\d+)\.vb$/);
        if (!projectFileHash && localIdMatch) {
          const sourceResponse = await voxaApi.getApiLocalModelsIdRaw({
            params: { path: { id: localIdMatch[1] } },
          });
          if (sourceResponse.response.ok) {
            sourceModel = sourceResponse.data as Record<string, unknown>;
            projectFileHash = String(sourceModel.projectFileHash || '');
          }
        }
        if (!asset?.hash || !projectFileHash) {
          res.writeHead(409);
          res.end(
            JSON.stringify({
              code: 'PROJECT_MODEL_SOURCE_MISSING',
              message: 'project model source file is missing',
            }),
          );
          return;
        }
        const importedModel = await voxaApi.postApiLocalModels({
          body: {
            modelName: name,
            modelType: ModelType.Project,
            creativeMode: CreativeMode.Model,
            modelFileHash: asset.hash,
            modelProjectFileHash: projectFileHash,
            modelPreviewFileHash:
              getLocalProjectModelPreviews()[name] ||
              String(sourceModel?.modelPreviewHash || '') ||
              asset.modelPreviewHash ||
              '',
            mapId: serverConfig.contentId,
          },
        });
        res.end(JSON.stringify(importedModel));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.writeHead(message.includes('already exists') ? 409 : 400);
        res.end(JSON.stringify({ message }));
      }
    };

    spec.httpRoutes['/api/project-scripts'] = async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'POST' });
        res.end(JSON.stringify({ message: 'method not allowed' }));
        return;
      }
      try {
        const body = await bodyParse(req) as Record<string, unknown>;
        const action = String(body.action || '');
        if (!['share', 'unshare', 'rename', 'delete'].includes(action)) {
          throw new Error('unsupported script action');
        }
        const result = await editServer!.replica.updateLocalSharedScript(
          action === 'share'
            ? { action, fileId: String(body.fileId || ''), hash: String(body.hash || '') }
            : action === 'rename'
            ? { action, fileId: String(body.fileId || ''), name: String(body.name || '') }
            : { action: action as 'unshare' | 'delete', fileId: String(body.fileId || '') },
        );
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({
          message: error instanceof Error ? error.message : String(error),
        }));
      }
    };

    spec.httpRoutes['/api/project-skins'] = async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET') {
        res.end(
          JSON.stringify({
            skinPreviews: getLocalProjectSkinPreviews(),
            skinProjects: getLocalProjectSkinProjects(),
          }),
        );
        return;
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'GET, POST' });
        res.end(JSON.stringify({ message: 'method not allowed' }));
        return;
      }
      try {
        const body = await bodyParse(req);
        const voxaURL = (
          process.env.VOXA_INTERNAL_URL ||
          process.env.VOXA_URL ||
          'http://127.0.0.1:3001'
        ).replace(/\/$/, '');
        const voxaApi = localVoxaApi(voxaURL);
        if (body.action === 'importLocal') {
          const skinIds = Array.isArray(body.skinIds)
            ? body.skinIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)
            : [];
          if (!skinIds.length) throw new Error('请选择要导入的本地皮肤');
          let result;
          for (const skinId of skinIds) {
            const model = await voxaApi.getApiLocalModelsId({
              params: { path: { id: String(skinId) } },
            }) as Record<string, unknown>;
            const hashes = [
              String(model.modelFileHash || ''),
              String(model.projectFileHash || ''),
              String(model.modelPreviewHash || ''),
            ].filter(Boolean);
            for (const hash of hashes) {
              await storeVoxaBlob(voxaApi, hash, spec.contentServer);
            }
            let skinName = String(model.modelName || `皮肤 ${skinId}`).trim();
            const skinAssets = editServer!.state.replica.extraProjectInfo.skinAssets;
            if (skinAssets[skinName]) {
              const baseName = skinName;
              let suffix = 2;
              while (skinAssets[`${baseName} (${suffix})`]) suffix += 1;
              skinName = `${baseName} (${suffix})`;
            }
            result = await editServer!.replica.updateLocalProjectSkin({
              action: 'create',
              newName: skinName,
              modelFileHash: String(model.modelFileHash || ''),
              previewHash: String(model.modelPreviewHash || ''),
              projectFileHash: String(model.projectFileHash || ''),
            });
          }
          res.end(JSON.stringify(result || {}));
          return;
        }
        if (body.action === 'prepareEdit') {
          const name = String(body.name || '').trim();
          const asset = editServer!.state.replica.extraProjectInfo.skinAssets[name];
          const projectFileHash = getLocalProjectSkinProjects()[name];
          if (!asset?.hash || !projectFileHash) {
            res.writeHead(409);
            res.end(
              JSON.stringify({
                message: '该皮肤缺少可编辑的 VOXA 工程文件',
              }),
            );
            return;
          }
          const importedSkin = await voxaApi.postApiLocalModels({
            body: {
              modelName: name,
              modelType: ModelType.ExtensionLib,
              creativeMode: CreativeMode.Skin,
              modelFileHash: asset.hash,
              modelProjectFileHash: projectFileHash,
              modelPreviewFileHash: getLocalProjectSkinPreviews()[name] || '',
              mapId: serverConfig.contentId,
            },
          });
          res.end(JSON.stringify(importedSkin));
          return;
        }
        if (body.action === 'setDefault') {
          const projectKey = serverConfig.containerName || String(serverConfig.contentId);
          await voxaApi.putApiLocalDefaultSkin({
            params: { query: { projectKey, mapId: String(serverConfig.contentId) } },
            body: {
              projectKey,
              mapId: serverConfig.contentId,
              skinId: 0,
            },
          });
        }
        const result = await editServer!.replica.updateLocalProjectSkin(
          body as LocalProjectSkinAction,
        );
        res.end(JSON.stringify(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.writeHead(message.includes('already exists') ? 409 : 400);
        res.end(JSON.stringify({ message }));
      }
    };
  }

  if (serverConfig.mode === 'play' && serverConfig.directSessionApi) {
    spec.httpRoutes['/api/server-info'] = async (req, res) => {
      setPublicCors(req, res);
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method !== 'GET') {
        res.writeHead(405);
        res.end('method not allowed');
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          name: process.env.BOX_SERVER_NAME || 'BOX 世界',
          engineVersion: process.env.BOX_ENGINE_VERSION || '0.1.1',
          protocolVersion: 1,
          contentId: serverConfig.contentId,
          maxPlayers: serverConfig.playerLimit,
        }),
      );
      return;
    };
    spec.httpRoutes['/api/session'] = (req, res) =>
      createSession(req, res, true);
  }
  return game;
}

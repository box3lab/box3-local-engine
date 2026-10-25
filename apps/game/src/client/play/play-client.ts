import { toWebSocketURL } from '../../../shared/websocket-url';
import { CameraBindingMode } from '@box/schema/input/input-schema';
import {
  PostMessageSchema,
  PostMessageType,
} from '@box/schema/navigator/navigator-schema';

import { createGameClient } from '..';
import { EngineClient } from '../client';
import { ReactEvents } from '../react-event';
import { messenger } from 'src/messenger';
import { CloseType } from 'src/engine/game-client-schema';
import { touchable } from 'src/utils/mobile';
import { resolvePublicUrl } from 'src/utils/public-url';

import {
  ClientStateSchema,
  GameClientPlayState,
  stateSchemasMap,
  StateSchemasMapType,
} from './play-client-schema';
import { store } from 'src/redux/play';
import { setUIConfig } from 'src/redux/slices/UIConfig';
import { GameAdminClient } from 'src/entry/admin-client';
import { LoadingController } from '@box/utils/loading/loading-controller';
import { ContentResolver } from '@box/content-server/content-fetch';
import { clientConfig } from 'src/config/client';
import { GameClientSocket } from 'src/utils/game-client-socket';
import { connectGameServer } from '../../utils/connect-game-server';
import { MuWebSocket } from '@box/mudb/socket/web/client';
import { createMuLogger } from '@box/utils/mutracer';
import { MuClient } from '@box/mudb';
import { NetLogClient } from 'src/utils/net-log/client';
import { consoleSink } from '@box/utils/console-sink';
import { LogLevel, LogMessage } from '@box/utils/logger';
import { GameClient } from 'src/engine/game-client';
import { MuSystemScheduler } from '@box/mudb/scheduler';
import { DISPOSED_WEAK_SET } from 'src/utils/performance-test';
import { connectNetLog } from 'src/utils/logger';
import { clearInteracted } from 'src/engine/utils/user-interact';
import { Settings } from 'src/engine/settings/settings-schema';
import { getFingerprint } from 'src/utils/fingerprint';
import { getToken } from 'src/utils/token';
import { resolveGameServerTarget } from 'src/utils/remote-game-server';

let hideAdminFn: (() => void) | undefined;
if (!process.env.RUSTY) {
  import('src/entry/admin-ui').then(({ hideAdmin }) => {
    hideAdminFn = hideAdmin;
  });
}

/**
 * 客户端引擎层的入口模块
 * 包括引擎渲染，rpc通讯，接口请求，日志记录等内容
 *
 * @export
 * @class PlayClient
 * @public state 存储与react组件相关的属性
 * @public rpc rpc实例（目前只有setSkin）
 * @public reactEvents react监听在引擎运行中会发生变化的数据
 */
export class PlayClient extends EngineClient {
  private appState = GameClientPlayState.LOADING;
  public state = ClientStateSchema.clone(ClientStateSchema.identity);
  private reactEvent = new ReactEvents<StateSchemasMapType>(stateSchemasMap);
  public listeners = this.reactEvent.listeners;
  public isAdmin = false;
  private _totalClock: number = 0;
  private _totalFrame = 0;
  private _fpsQueen: number[] = [];
  private _lowFrameRateShowed = false;
  private onPlayClientCloseCallback?: Function;
  private disposed = false;
  private readonly messengerDisposers: Array<() => void> = [];
  private readonly onBeforeUnload = () => {
    this.appState = GameClientPlayState.REFRESHING;
  };

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.appState = GameClientPlayState.REFRESHING;
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    this.messengerDisposers.splice(0).forEach(remove => remove());
    this.onGameChange.unsubAll();
    this.onGameReady.unsubAll();
    this.onPlayClientCloseCallback = undefined;
    super.dispose();
  }

  constructor() {
    super('play');
  }

  public selectBuiltInAvatarSkin(skinId: string) {
    this.game.player.selectBuiltInAvatarSkin(skinId);
  }

  public addMessengerEventListeners = () => {
    const listen: typeof messenger.messageTool.eventOn = (event, handler) => {
      messenger.messageTool.eventOn(event, handler);
      this.messengerDisposers.push(() => messenger.messageTool.eventOff(event, handler));
    };
    listen(
      'setSettings',
      (settings: Partial<Settings>) => {
        this.setGameSettings(settings);
      },
    );
    listen('postMessage', (payload) => {
      this.game.navigator.postMessage(JSON.stringify(payload));
    });
    listen('togglePlayerRender', ({ hide }) => {
      this.hidePlayers(hide);
    });
    // 监听screenshot事件并回传截图
    listen('screenshot', async () => {
      try {
        await this.sendScreenshot();
      } catch (error) {
        console.error(error);
      }
    });
    listen('setSkin', (skin) => {
      // 当前用户avatar皮肤数据完全由后端管理
      // 不需要管iframe传入的数据，直接通知game server更新后端最新保存的皮肤数据
      this.game.player.updateAvatarSkin();
    });

    listen('playEmote', ({ emote }) => {
      if (this.game) {
        this.game.interact.protocol.server.message.playEmote(emote);
      }
    });

    listen(
      'getSettings',
      <K extends keyof Settings>(keys?: K[]) => {
        const settings = this.game.state.settings;
        if (!keys) {
          messenger.messageTool.emitEvent('responseGetSettings', settings);
        } else {
          const result = {} as Pick<Settings, K>;
          keys.forEach((key) => {
            result[key] = settings[key];
          });
          messenger.messageTool.emitEvent('responseGetSettings', result);
        }
      },
    );
  };

  private receiveScriptMessage(message: PostMessageType) {
    try {
      const value = JSON.parse(message.value);
      if (message.isOld) {
        messenger.messageTool.emitEvent(message.type as any, value);
      } else {
        messenger.messageTool.emitEvent('fromScript', {
          type: message.type,
          value,
        });
      }
    } catch (error) {
      console.log('parse server message error: ', error);
    }
    this.game.navigator.clearPostMessage();
    PostMessageSchema.assign(this.state.iframeMessage, message);
  }

  public preconnect(error?: (error?: CloseType) => void) {
    if (this.disposed) return;
    const { logger, bufferSink } = this;
    const { game, client } = createGameClient(
      {
        logger,
        pinoLogger: this.pinoLogger,
        bufferSink,
        console,
        autoCreateElement: true,
        connectGame: this.connectGame,
      },
      (config) => {
        if (config.admin) this.admin.init();
        this.isAdmin = config.admin;
      },
    );

    this.setGame(game);

    this.admin = new GameAdminClient({
      app: this,
      client,
    });

    this.game.onClose.sub((err) => {
      // TODO close回调
      console.log('game close');
      error && error(err);
    });

    if (!this.game.state.headless) {
      this._listenBrowserEvent();
    }

    this.game.preconnect();

    // iframe事件监听
    this.addMessengerEventListeners();
  }

  /**
   * 按 MapID 连接游戏服务器
   * 连接成功后释放旧连接
   * @param hash
   * @param serverId
   * @returns
   */
  public connectGame = async (hash: string, serverId?: string) => {
    if (this.disposed) return;
    const token = getToken();
    const response = await fetch(
      `${clientConfig.ARENA_URL}/api/getMapInfo?hash=${hash}&mode=play`,
      {
        headers: token ? { authorization: token } : undefined,
        credentials: 'include',
      },
    );

    const mapInfo = await response.json();
    if (this.disposed) return;
    clientConfig.mapInfo = mapInfo;
    clientConfig.name = hash;
    if (clientConfig.isLocalGameServer) {
      const roomPath = serverId && serverId !== 'public'
        ? `/__room/${encodeURIComponent(serverId)}`
        : '';
      const runtimeBase = resolvePublicUrl(`/runtime/play/${encodeURIComponent(hash)}${roomPath}`);
      const assetBase = clientConfig.launcherServiceWorkerMode
        ? clientConfig.CDN_PATH
        : runtimeBase;
      clientConfig.CDN_PATH = assetBase;
      clientConfig.OSS_CDN_URL = assetBase;
      clientConfig.BACKEND_SERVER_URL = runtimeBase;
      clientConfig.MAAS_BACKEND_SERVER_URL = runtimeBase;
      clientConfig.JAVA_BACKEND_SERVER_URL = runtimeBase;
      clientConfig.CREATERA_BACKEND_SERVER_URL = runtimeBase;
    }

    hideAdminFn?.();
    // 对应 SoundClient 里的引用
    clearInteracted();
    
    const loadingController = new LoadingController();
    const gameServerTarget = resolveGameServerTarget(clientConfig);
    const content = new ContentResolver({
      cdnPath: gameServerTarget.assetBaseURL,
      ossCdnURL: gameServerTarget.assetBaseURL,
      avatarCdnURL: clientConfig.launcherServiceWorkerMode
        ? clientConfig.launcherAvatarCdnURL
        : undefined,
      cacheIPFS: clientConfig.cacheIPFS,
      loadingController: loadingController,
    });

    let configuredAudioHashes: string[] | undefined;

    const socket = new GameClientSocket(
      (async () => {
        /**
         * 没有直接统一用clientConfig.ARENA_URL，因为本地起next服务的时候，可能会需要读取本地的配置。
         * 比如isLocalGameServer为true时。
         */
        let visitorId: string = 'defaultVisitorId';

        if (
          !process.env.RUSTY &&
          (gameServerTarget.isRemote || !clientConfig.isLocalGameServer)
        ) {
          try {
            visitorId = (await getFingerprint()).visitorId;
          } catch (err) {
            console.error('Failed to get visitorId by Fingerprint');
          }
        }

        const { config: sessionConfig, prefetchAbortController } =
          await connectGameServer(
            loadingController,
            gameServerTarget,
            visitorId,
            serverId,
          );

        if (this.disposed) {
          prefetchAbortController.abort();
          throw new Error('游戏页面已退出');
        }

        configuredAudioHashes = sessionConfig.configuredAudioHashes;

        // 以服务器数据为准判断是否管理员
        if (sessionConfig.admin) this.admin.init();
        this.isAdmin = sessionConfig.admin;

        // 将加载好的资源存入content实例
        prefetchAbortController.abort();
        content.setPrefetchCaches(sessionConfig.prefetchCaches);

        return new MuWebSocket({
          sessionId: sessionConfig.sessionId,
          sessionProof: sessionConfig.sessionProof,
          url: toWebSocketURL(sessionConfig.socketServerUrl, window.location.href),
          maxSockets: sessionConfig.maxSockets,
          logger: createMuLogger(this.logger, 'mudb/src-socket'),
        });
      })(),
    );

    const client = new MuClient(
      socket,
      createMuLogger(this.logger),
      // Keep protocol validation enabled for production local runtimes. This
      // condition must stay aligned with services/game-server/createServer.
      process.env.NODE_ENV !== 'development' && !clientConfig.isLocalGameServer,
    );

    const netLog = new NetLogClient({
      client,
      sink: consoleSink,
    });

    this.bufferSink.replace((msg: LogMessage) => {
      if (msg.level <= LogLevel.WARN) {
        consoleSink(msg);
      }
      netLog.log(msg);
    });

    connectNetLog((ev) => {
      netLog.logPino(ev);
    });

    // 初始化引擎
    const game = new GameClient({
      client,
      content,
      pinoLogger: this.pinoLogger,
      logger: this.logger,
      scheduler: MuSystemScheduler,
      clientConfig,
      loadingController,
      console,
      autoCreateElement: true,
      connectGame: this.connectGame,
    });

    socket.defer.then(() => {
      if (!this.disposed) game.sound.loadFirstSampleHashes(configuredAudioHashes || []);
    }, () => {});

    // 使用新的 GameClient、GameAdminClient 与对应的 MuClient
    process.env.NODE_ENV === 'development' &&
      this.admin &&
      DISPOSED_WEAK_SET.add(this.admin);
    this.admin = new GameAdminClient({
      app: this,
      client,
    });

    this.appState = GameClientPlayState.LOADING;

    this.setGame(game);

    this.game.preconnect();

    // Start GameClient
    this.game.onReady.sub(() => {
      if (!touchable) {
        this.game.input.setCameraBindingMode(CameraBindingMode.leftKey);
      }
    });

    this.game.onFrame.sub(() => {
      this.initState();
      this.reactEvent.frameState(this.state);
      if (
        !PostMessageSchema.equal(
          this.state.iframeMessage,
          this.game.state.navigator.postMessage,
        )
      ) {
        this.receiveScriptMessage(this.game.state.navigator.postMessage);
      }

      this.checkLowFrameRate();
    });

    this.game.onClose.sub((message: CloseType) => {
      if (this.appState === GameClientPlayState.REFRESHING) {
        return;
      }
      this.appState = GameClientPlayState.ERROR;
      this.onPlayClientCloseCallback && this.onPlayClientCloseCallback(message);
      messenger.messageTool.emitEvent('status', 'closed');
    });
    this.game.start();
  };

  public initState() {
    const gameState = this.game.state;

    this.state.hyperLink = gameState.hyperLink;
    this.state.settings = gameState.settings;
  }

  public clickedStart = false;
  public start = (spec: {
    ready: () => void;
    frame: () => void;
    close: (error: CloseType) => void;
  }) => {
    if (this.disposed || this.clickedStart) {
      return;
    }

    this.onPlayClientCloseCallback = spec.close;

    if (process.env.NODE_ENV !== 'production') {
      console.log('---start engine---', this.appState);
    }
    this.clickedStart = true;
    if (
      this.appState === GameClientPlayState.SELECT_SKIN ||
      this.appState === GameClientPlayState.LOADING
    ) {
      this.appState = GameClientPlayState.CONNECTING;

      this.game.onReady.sub(() => {
        this.appState = GameClientPlayState.GAME;
        // fire ready handler
        spec.ready();

        this.reactEvent.frameState(this.state);
        if (!touchable) {
          this.game.input.setCameraBindingMode(CameraBindingMode.leftKey);
        }
      });

      this.game.onFrame.sub(() => {
        this.initState();
        this.reactEvent.frameState(this.state);
        if (
          !PostMessageSchema.equal(
            this.state.iframeMessage,
            this.game.state.navigator.postMessage,
          )
        ) {
          this.receiveScriptMessage(this.game.state.navigator.postMessage);
        }

        this.checkLowFrameRate();
      });

      this.game.onClose.sub((message: CloseType) => {
        if (this.appState === GameClientPlayState.REFRESHING) {
          return;
        }
        this.appState = GameClientPlayState.ERROR;
        spec.close(message);
        messenger.messageTool.emitEvent('status', 'closed');
      });

      this.game.start();
    } else {
      this.logger.warn('called start twice');
    }
  };

  private checkLowFrameRate = () => {
    if (
      this._lowFrameRateShowed ||
      this.game.state.settings.graphicQuality === 0
    )
      return;

    this._totalClock += this.game.state.clock.deltaClock;
    this._totalFrame++;
    if (this._totalClock >= 1000) {
      const fps = Math.ceil((this._totalFrame / this._totalClock) * 1000);
      this._totalFrame = 0;
      this._totalClock = this._totalClock % 1000;
      this._fpsQueen.push(fps);
      if (this._fpsQueen.length > 10) {
        this._fpsQueen.shift();
        const avgFps =
          this._fpsQueen.reduce((a, b) => a + b, 0) / this._fpsQueen.length;
        if (avgFps < 30) {
          this._lowFrameRateShowed = true;
          store.dispatch(setUIConfig({ lowFrameRate: true }));
          return;
        }
      }
    }
  };

  private _listenBrowserEvent = () => {
    window.addEventListener('beforeunload', this.onBeforeUnload);
  };

  public enableJoystick = () => (this.game.state.input.joystickEnabled = true);

  public setJoystick = (x: number, y: number) => {
    const joystick = this.game.state.input.joystick;
    joystick[0] = x;
    joystick[1] = y;
  };
}

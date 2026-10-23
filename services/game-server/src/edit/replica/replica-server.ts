import { vec3 } from 'gl-matrix';
import type { Logger } from 'pino';
import { MuRemoteClient, MuServer, MuServerProtocol } from '@box/mudb/server';
import {
  EditReplicaInitSchema,
  EditReplicaProtocol,
  ProjectAction,
  ProjectActionSchema,
  ProjectActionSequenceSchema,
  ProjectStateSchema,
  ProjectStoreSchema,
  VoxelWriteSequenceSchema,
} from '@box/schema/replica/replica-schema';
import { EditServerState } from '../edit-server-schema';
import {
  AmbientSoundRDA,
  DeleteAssetsRDA,
  AssetType,
  EnvironmentRDA,
  GamepadRDA,
  GroupProjectStoreSchema,
  PhysicsRDA,
  PlayerRDA,
  ProjectRDA,
  VoxelRDA,
} from '@box/schema/project/project-rda';
import {
  combinePermissionSet,
  OWNER_PERMISSIONS,
  PermissionAccessLevel,
  PermissionAction,
  PermissionActionSequenceSchema,
  PermissionRDA,
  Permissions,
  PermissionSetSchema,
  PermissionTokenSchema,
} from '@box/schema/permissions/permission-rda';
import { Semaphore } from '@box/utils/semaphore';
import { RDATransaction } from './transaction/transaction';
import { VoxelWrite, VoxelWriteSchema } from '@box/schema/voxel/voxel-protocol';
import { checkProjectActionSequence } from './validate/validate-project-action';
import { checkVoxelWriteSequence } from './validate/validate-voxel-action';
import { checkPermissionActionSequence } from './validate/validate-permission-action';
import {
  InviteLinkSchema,
  SessionPermissionIndexSchema,
  SessionPermissionSchema,
} from './replica-server-schema';
import { recordVoxelInfo } from '../../voxel/voxel-server';
import {
  generatePermissionToken,
  parsePermissionToken,
} from '@box/build-system/permissions/permission-token';
import { CodeEditorServerController } from '../code-editor/code-editor-server-controller';
import {
  copySoundAssets,
  updateHotProjectAssets,
} from '@box/build-system/project/bake';
import { CHUNK_SHIFT } from '@box/schema/voxel/voxel-collision-schema';
import {
  storeProject,
  StoreProjectRes,
} from '@box/build-system/project/project-serialize';
import { storePermissions } from '@box/build-system/permissions/permission-serialize';
import { CloseType } from '@box/schema/types/game';
import {
  ExtraProjectInfo,
  ExtraProjectInfoSchema,
  getMeshPath,
} from '@box/schema/project/hot-schema';
import {
  applyLocalSharedScriptMutation,
  canPersistLocalSharedScript,
  isSharedAfterLocalScriptAction,
  localSharedScriptLockOwnerId,
} from './local-shared-script-state';
import { MuReadStream, MuWriteStream } from '@box/mudb/stream';
import { getExtraProject } from '../../project/project-extra';
import { getConfigSync } from '../../../config/server';
import {
  BroadcastDataType,
  BroadcastMsg,
  OPCode,
  P2PDataType,
  ReceivedMsg,
} from '@box/schema/chat/chat-schema';
import {
  filterGroupProjectActions,
  generateBroadcastMsg,
  generateEngineReadyMsg,
  generateP2PMsg,
  getGroupProjectBySocket,
  serializeGroupProjectStoreByProject,
  updateProjectStoreByGroupProject,
} from '../../group-project';
import { GroupProjectStore } from '@box/schema/group-project/rda';
import { OssStoreType } from '@box/content-server';
import {
  getLocalExtraProjectMode,
  getLocalExtraProjectStateHash,
  getDeletedLocalProjectModelPaths,
  getLocalProjectSkinPreviews,
  getLocalProjectSkinProjects,
  persistLocalGroupProjectMetaData,
  persistLocalProjectState,
  withLocalGroupSharedResourceLock,
  syncLocalProjectModelPaths,
  setDeletedLocalProjectModelPath,
  updateLocalProjectSkinMetadata,
  updateLocalProjectModelMetadata,
} from '../../project/local-project-state';
import { mergeExtraProjectInfo } from '../../project/project-extra';
import { decodeExtraProjectInfo } from '../../project/decode-extra-project';
import { isContentHash } from '../../project/content-hash';
import {
  resolveRenamedProjectMesh,
  runtimeMeshAssets,
} from '../../project/runtime-mesh-assets';
import {
  moveProjectModelToTrash,
  purgeProjectModelFromTrash,
  restoreProjectModelFromTrash,
} from '../../project/project-model-trash';

const TOKEN_MIN_DURATION = 60 * 1000;
const TOKEN_MAX_DURATION = 24 * 60 * 60 * 1000;
const THUMBNAILSIZE = 512;

const DEFAULT_BRANCH = 'master';

export type LocalProjectSkinAction =
  | {
      action: 'create';
      newName: string;
      modelFileHash: string;
      previewHash?: string;
      projectFileHash?: string;
    }
  | { action: 'setDefault'; name: string }
  | { action: 'unsetDefault'; name: string }
  | { action: 'rename'; name: string; newName: string }
  | { action: 'delete'; name: string }
  | {
      action: 'update';
      name: string;
      newName: string;
      modelFileHash: string;
      previewHash?: string;
      projectFileHash?: string;
    };

export type LocalProjectModelAction =
  | {
      action: 'create';
      newName: string;
      modelId: number;
      modelFileHash: string;
      animated?: boolean;
      previewHash?: string;
      projectFileHash?: string;
    }
  | { action: 'rename'; name: string; meshPath?: string; newName: string }
  | { action: 'delete'; name: string; meshPath?: string }
  | { action: 'restore'; name: string; meshPath?: string }
  | { action: 'purge'; name: string; meshPath?: string }
  | {
      action: 'update';
      name: string;
      meshPath?: string;
      newName: string;
      modelFileHash: string;
      previewHash?: string;
      projectFileHash?: string;
    };

export type LocalSharedScriptAction =
  | { action: 'share'; fileId: string; hash: string }
  | { action: 'save'; fileId: string; hash: string }
  | { action: 'unshare'; fileId: string }
  | { action: 'rename'; fileId: string; name: string }
  | { action: 'delete'; fileId: string }
  | { action: 'lock'; fileId: string; ownerId: number; ownerTitle: string }
  | { action: 'unlock'; fileId: string; ownerId: number };

type ReplicaRemoteClient = MuRemoteClient<
  (typeof EditReplicaProtocol)['client']
>;

export class EditReplicaServer {
  private _protocol: MuServerProtocol<typeof EditReplicaProtocol>;
  private _state: EditServerState;
  private _codeEditorController: CodeEditorServerController;
  private _logger: Logger;
  private _featureFlags: string[];

  private _permissionSemaphore = new Semaphore();
  private _projectSemaphore = new Semaphore();
  private _observedLocalExtraProjectHash = getLocalExtraProjectStateHash();
  private _nextLocalExtraProjectCheck = 0;
  private _localExtraProjectRefreshPending = false;
  private _localProjectModelPathsSignature: string | undefined;

  private _syncLocalProjectModelMembership() {
    if (
      getConfigSync()?.method !== 'local' ||
      !process.env.BOX_GROUP_PROJECT_STATE_PATH
    ) {
      return;
    }
    const replicaState = this._state.replica;
    replicaState.projectStore.state(ProjectRDA, replicaState.project);
    const paths = Array.from(
      new Set(
        Object.values(replicaState.project.entitiesTree).flatMap((node) => {
          const mesh = node.value?.mesh;
          return typeof mesh === 'string' && mesh ? [mesh] : [];
        }),
      ),
    ).sort();
    const signature = paths.join('\u0000');
    if (signature === this._localProjectModelPathsSignature) return;
    syncLocalProjectModelPaths(paths);
    this._localProjectModelPathsSignature = signature;
  }

  private async _savePermissions() {
    const replicaState = this._state.replica;
    if (!replicaState.permissionsHashDirty) {
      this._logger.info(
        `skip save permissions ${replicaState.permissionHash}`,
      );
      return;
    }
    if (getConfigSync()?.method === 'local') {
      replicaState.permissionsHashDirty = false;
      this._logger.info('skip backend permission update in local mode');
      return;
    }
    this._logger.info(
      `permissions changed, save permissions ${replicaState.permissionHash}`,
    );
    let previewImage = replicaState.project.info.previewImage;
    if (previewImage === replicaState.lastImageHash) {
      previewImage = replicaState.lastOptimizedHash;
    } else {
      replicaState.lastImageHash = previewImage;
      try {
        let ext = '';
        const matchExt = previewImage.match(/\./);
        if (matchExt !== null) {
          ext = previewImage.slice(matchExt.index);
        }
        previewImage =
          (await this._state.buildSystem.build(
            'genThumbnail',
            previewImage,
            THUMBNAILSIZE,
          )) + ext;
      } catch (e) {}
      replicaState.lastOptimizedHash = previewImage;
    }
    // save project
    this._logger.info(
      `updating map hash  ${this._state.game.state.settings.contentId.toString()} ${
        replicaState.permissionHash
      }`,
    );
    // TODO: 权限更换为后端控制以后再改 save project
    await this._state.brpc.content.api.updateGame({
      content_id: this._state.publish.gameId,
      name: replicaState.project.info.displayName,
      describe: replicaState.project.info.description,
      image: previewImage,
      hash: replicaState.permissionHash,
      engine_version: '',
    });
    this._logger.info(`update map hash success`);
    replicaState.permissionsHashDirty = false;
  }

  private _canUpdateVoxels() {
    return (
      0 < this._projectSemaphore.counter &&
      this._state.game.state.voxelState.ready &&
      !this._state.game.state.replica.running
    );
  }

  private _canUpdateProject() {
    const game = this._state.game;
    return (
      0 < this._projectSemaphore.counter &&
      !game.syncInProgress() &&
      !game.state.replica.running
    );
  }

  private _setPermissionsDirty() {
    const replicaState = this._state.replica;
    replicaState.permissionsHashDirty = replicaState.permissionsDirty = true;
  }

  private _setProjectDirty() {
    const replicaState = this._state.replica;
    replicaState.permissionsDirty =
      replicaState.hotProjectDirty =
      replicaState.projectHashDirty =
      replicaState.projectDirty =
        true;

    this._setPermissionsDirty();
  }

  private _updatePermissionsIndex() {
    const replicaState = this._state.replica;
    SessionPermissionIndexSchema.assign(
      replicaState.sessionPermission,
      SessionPermissionIndexSchema.identity,
    );

    const permissions = replicaState.permissions;
    const index = replicaState.sessionPermission;
    const connections = this._state.game.state.connectionSet;

    const groups = permissions.groups;
    const groupIds = Object.keys(groups);

    const defaultGroups = replicaState.defaultGroups;
    defaultGroups.length = 0;
    for (let i = 0; i < groupIds.length; ++i) {
      if (groups[groupIds[i]].defaultGroup) {
        defaultGroups.push(groupIds[i]);
      }
    }

    for (let i = 0; i < connections.length; ++i) {
      // unpack connection info
      const c = connections[i];
      const sessionId = c.sessionId;
      const userId = c.sessionData.user.id;

      // if user is banned then kick them out
      if (this.isUserBlocked(userId)) {
        this._logger.info(`kicking blocked user ${userId}`);
        const reason = this.blockReason(userId);
        this._state.game.net.kickSession(sessionId, reason);
        continue;
      }

      // create new permission record
      const userPermission = (index[sessionId] = SessionPermissionSchema.clone(
        SessionPermissionSchema.identity,
      ));
      userPermission.userId = userId;
      if (!userId) {
        // special case: guests can't be in groups, get no permissions
        PermissionSetSchema.assign(
          userPermission.permissions,
          PermissionSetSchema.identity,
        );
        userPermission.guest = true;
        userPermission.owner = false;
      } else {
        const permissionSet = PermissionSetSchema.assign(
          userPermission.permissions,
          PermissionSetSchema.identity,
        );
        userPermission.guest = false;
        if (userId === permissions.owner || c.sessionData.isAdmin) {
          // special case: owner has unlimited, unrestricted permissions
          PermissionSetSchema.assign(permissionSet, OWNER_PERMISSIONS);
          userPermission.owner = userId === permissions.owner;
        } else {
          userPermission.owner = false;
        }
        // compute user permission set by looping over all groups
        for (let j = 0; j < groupIds.length; ++j) {
          const groupName = groupIds[j];
          const group = groups[groupName];
          if (userId in group.members) {
            combinePermissionSet(permissionSet, group.permissions);
          }
          userPermission.groups.push(groupName);
        }
      }
    }
  }

  public getSessionPermissions(sessionId: string) {
    const permissions = this._state.replica.sessionPermission[sessionId];
    if (permissions) {
      return permissions.permissions;
    }
    return PermissionSetSchema.identity;
  }

  constructor(spec: {
    server: MuServer;
    state: EditServerState;
    projectHash: string;
    projectState: typeof ProjectStateSchema.identity;
    extraProjectInfo: ExtraProjectInfo;
    permissionHash: string;
    permissions: Permissions;
    codeEditorController: CodeEditorServerController;
    featureFlags: string[];
    pendingActions: ProjectAction[][];
    groupStore?: GroupProjectStore;
    logger: Logger;
  }) {
    const protocol = (this._protocol =
      spec.server.protocol(EditReplicaProtocol));
    const state = (this._state = spec.state);
    this._logger = spec.logger.child({ caller: 'replica' });
    this._featureFlags = spec.featureFlags;
    this._codeEditorController = spec.codeEditorController;

    const replicaState = state.replica;

    // initialize project
    replicaState.projectHash = spec.projectHash;
    const projectStore = (replicaState.projectStore = ProjectRDA.createStore(
      spec.projectState,
    ));

    if (spec.groupStore) {
      updateProjectStoreByGroupProject(projectStore, spec.groupStore);
    }

    // apply 初始化期间收到的actions
    for (let i = 0; i < spec.pendingActions.length; ++i) {
      for (let j = 0; j < spec.pendingActions[i].length; ++j) {
        projectStore.apply(ProjectRDA, spec.pendingActions[i][j]);
      }
    }
    replicaState.project = projectStore.state(ProjectRDA, replicaState.project);
    // 订阅actions
    this._subscribeGroupProjectActions();
    // 通知socket，已经ready，可以发送当前容器的state了
    this._sendGroupProjectReady();
    // 当websocket断线重连后，重新通过websocket或者http获取初始化数据
    this._handleGroupProjectReconnect();
    // 订阅SHARED_STATE_REQUEST，然后通过SHARED_STATE_RESPONSE发送state
    this._state.game.webSocket.onMessage(async (data: string) => {
      const message: ReceivedMsg = JSON.parse(data);
      if (message.opcode !== OPCode.Dispatch) {
        return;
      }
      // == 发送当前容器状态 ==
      if (
        message.event === 'POINT_TO_POINT' &&
        message.data.data.type === P2PDataType.GROUP_PROJECT_REQUEST
      ) {
        this._logger.info(
          `SHARE_STATE: send state to ${message.data.targetId}`,
        );

        const sharedStore = serializeGroupProjectStoreByProject(
          replicaState.projectStore,
        );
        // 1k
        const ws = new MuWriteStream(1024);
        GroupProjectStoreSchema.diff(
          GroupProjectStoreSchema.identity,
          sharedStore,
          ws,
        );
        const bytes = ws.bytes();
        ws.destroy();
        const hash = await this._state.buildSystem.storeContentToS3(bytes, {
          ossStoreType: OssStoreType.Temp,
        });
        this._logger.info(`SHARE_STATE: send hash is ${hash}`);
        this._state.game.webSocket.send(
          generateP2PMsg(
            {
              type: P2PDataType.GROUP_PROJECT_RESPONSE,
              payload: hash,
            },
            message.data.targetId,
          ),
        );
      }
    });

    this._setProjectDirty();

    // initialize permissions
    replicaState.permissionHash = spec.permissionHash;
    const permissionStore = (replicaState.permissionStore =
      PermissionRDA.createStore(spec.permissions));
    replicaState.permissions = permissionStore.state(
      PermissionRDA,
      replicaState.permissions,
    );
    this._updatePermissionsIndex();

    // initialize extra project info
    ExtraProjectInfoSchema.assign(
      replicaState.extraProjectInfo,
      spec.extraProjectInfo,
    );
    replicaState.hotProjectDirty = true;

    protocol.configure({
      message: {
        project: (client, actions) => {
          if (
            checkProjectActionSequence(
              this.getSessionPermissions(client.sessionId),
              actions,
            )
          ) {
            const _actions = ProjectActionSequenceSchema.clone(actions);

            // 共享数据的action需要转发给其他server
            const groupProjectActions = filterGroupProjectActions(_actions);
            if (groupProjectActions.length > 0) {
              this._broadcastActionsToSocket(groupProjectActions);
            }

            this._applyProjectTransaction(_actions)
              .finally(() => ProjectActionSequenceSchema.free(_actions))
              .catch((e) =>
                this._logger.error(`error applying project tx: ${e}`),
              );
          } else {
            this._logger.info(`bad project action from ${client.sessionId}`);
            this._rollbackProject(client, actions);
          }
        },
        optimisticProjectAction: (client, actions) => {
          if (
            checkProjectActionSequence(
              this.getSessionPermissions(client.sessionId),
              actions,
            ) &&
            this._canUpdateProject()
          ) {
            const store = replicaState.projectStore;
            for (let i = 0; i < actions.length; ++i) {
              store.apply(ProjectRDA, actions[i]);
            }
            this._setProjectDirty();
            this._syncLocalProjectModelMembership();

            // broadcast to all clients except the client that dispatched the optimistic action
            const connections = this._state.game.state.connectionSet;
            for (let i = 0; i < connections.length; ++i) {
              const sessionId = connections[i].sessionId;
              if (sessionId !== client.sessionId) {
                const otherClient = this._protocol.clients[sessionId];
                if (otherClient) {
                  otherClient.message.project(actions);
                }
              }
            }
          }
        },
        // because project actions are handled opportunistically, have to handle this situation a bit carefully
        rollbackProject: (client, inverse) => {
          if (
            checkProjectActionSequence(
              this.getSessionPermissions(client.sessionId),
              inverse,
            )
          ) {
            const _actions = ProjectActionSequenceSchema.clone(inverse);
            this._applyProjectTransaction(_actions)
              .finally(() => ProjectActionSequenceSchema.free(_actions))
              .catch((e) =>
                this._logger.error(`error applying project tx: ${e}`),
              );
          } else {
            this._rollbackProject(client, inverse.reverse());
          }
        },
        voxel: (client, writes) => {
          if (
            checkVoxelWriteSequence(
              this.getSessionPermissions(client.sessionId),
              writes,
            )
          ) {
            if (!this._canUpdateVoxels()) {
              const bufferedWrites = this._state.replica.bufferedVoxelWrites;
              for (let i = 0; i < writes.length; ++i) {
                bufferedWrites.push(VoxelWriteSchema.clone(writes[i]));
              }
              this._rollbackVoxel(client, writes);
            } else {
              this._applyVoxelTransaction(writes);
            }
          } else {
            this._logger.info(`bad voxel action from ${client.sessionId}`);
            this._rollbackVoxel(client, writes);
          }
        },
        permission: (client, actions) => {
          if (
            checkPermissionActionSequence(
              this.getSessionPermissions(client.sessionId),
              actions,
            )
          ) {
            this._logger.info(
              `permission update from ${
                client.sessionId
              }. actions=${JSON.stringify(actions)}`,
            );
            const _actions = PermissionActionSequenceSchema.clone(actions);
            this._applyPermissionTransaction(_actions)
              .finally(() => PermissionActionSequenceSchema.free(_actions))
              .catch((e) =>
                this._logger.error(`error applying permission tx: ${e}`),
              );
          } else {
            this._logger.info(`bad permission action from ${client.sessionId}`);
            this._rollbackPermissions(client, actions);
          }
        },
        updateExtraProject: this._checkAndSetExtraProject,

        rollbackVoxel: this._rollbackVoxel,
        rollbackPermission: this._rollbackPermissions,

        startProject: this._handlePlayRPC.bind(this, this.startProject),
        stopProject: this._handlePlayRPC.bind(this, this.stopProject),
        saveProject: async (client, data) => {
          this.saveProject(parseInt(data.userId))
            .then(() => {
              client.message.rpcResponse({
                token: data.token,
                result: 'save project success',
                error: '',
              });
            })
            .catch((e) => {
              client.message.rpcResponse({
                token: data.token,
                result: 'save project fail',
                error: e,
              });
            });
        },

        restart: async (client) => {
          this._logger.info(`restart from ${client.sessionId}`);
          process.exit(0);
        },
        upgradeDatabase: async (client, { token }) => {
          try {
            this._logger.info(`upgrade database from ${client.sessionId}`);

            this._logger.info('try to stop project');
            await this.stopProject();

            this._logger.info('set storageMode to pg');
            const store = replicaState.projectStore;
            const action = ProjectRDA.action(store);
            store.apply(ProjectRDA, action.storageMode('pg'));
            this._setProjectDirty();

            this._logger.info('save project');
            await this.saveProject();

            client.message.rpcResponse({
              token,
              result: 'upgrade database success',
              error: '',
            });
          } catch (e) {
            client.message.rpcResponse({
              token,
              result: 'upgrade database fail',
              error: e,
            });
          }
        },

        checkoutProject: async (client, { token, hash, oldHash }) => {
          this._logger.info(`checkout called ${client.sessionId} ${hash}`);
          if (!this.getSessionPermissions(client.sessionId).versionControl) {
            this._logger.info('invalid checkout call from ' + client.sessionId);
            return client.message.rpcResponse({
              token,
              result: '',
              error: 'version modification not allowed',
            });
          } else {
            try {
              return client.message.rpcResponse({
                token,
                result: 'success',
                error: '',
              });
            } catch (e) {
              return client.message.rpcResponse({
                token,
                result: '',
                error: e.stack,
              });
            }
          }
        },

        createBranch: (client, { token, branch }) => {
          if (!this.getSessionPermissions(client.sessionId).versionControl) {
            this._logger.error(
              'invalid call to create branch from ' + client.sessionId,
            );
            return client.message.rpcResponse({
              token,
              result: '',
              error: 'version control not allowed',
            });
          } else {
            this.createBranch(branch)
              .then((result) => {
                if (result) {
                  client.message.rpcResponse({
                    token,
                    result,
                    error: '',
                  });
                } else {
                  client.message.rpcResponse({
                    token,
                    result: '',
                    error: 'error creating branch',
                  });
                }
              })
              .catch((e) => {
                this._logger.error(e);
                client.message.rpcResponse({
                  token,
                  result: '',
                  error: 'error creating branch: ' + e,
                });
              });
          }
        },

        switchBranch: (client, { token, branch }) => {
          if (!this.getSessionPermissions(client.sessionId).versionControl) {
            this._logger.error(
              'invalid call to switch branch from ' + client.sessionId,
            );
            return client.message.rpcResponse({
              token,
              result: '',
              error: 'version control not allowed',
            });
          } else {
            this.switchBranch(branch)
              .then((result) => {
                if (result) {
                  client.message.rpcResponse({
                    token,
                    result,
                    error: '',
                  });
                } else {
                  client.message.rpcResponse({
                    token,
                    result: '',
                    error: 'error switch branch',
                  });
                }
              })
              .catch((e) => {
                this._logger.error(e);
                client.message.rpcResponse({
                  token,
                  result: '',
                  error: 'error switch branch: ' + e,
                });
              });
          }
        },

        renameBranch: (client, { token, branch, oldBranch }) => {
          if (!this.getSessionPermissions(client.sessionId).versionControl) {
            this._logger.error(
              'invalid call to rename branch from ' + client.sessionId,
            );
            return client.message.rpcResponse({
              token,
              result: '',
              error: 'version control not allowed',
            });
          } else {
            this.renameBranch(oldBranch, branch)
              .then((result) => {
                if (result) {
                  client.message.rpcResponse({
                    token,
                    result,
                    error: '',
                  });
                } else {
                  client.message.rpcResponse({
                    token,
                    result: '',
                    error: 'error rename branch',
                  });
                }
              })
              .catch((e) => {
                this._logger.error(e);
                client.message.rpcResponse({
                  token,
                  result: '',
                  error: 'error rename branch: ' + e,
                });
              });
          }
        },

        requestToken: (client, { token, duration, group }) => {
          if (this.getSessionPermissions(client.sessionId).editPermissions) {
            if (!(group in replicaState.permissions.groups)) {
              return client.message.rpcResponse({
                token,
                result: '',
                error: 'invalid group',
              });
            }
            const durationMs = Math.max(
              TOKEN_MIN_DURATION,
              Math.min(TOKEN_MAX_DURATION, +duration || 0),
            );
            const permissionToken = PermissionTokenSchema.clone(
              PermissionTokenSchema.identity,
            );
            const expiredAt = new Date(Date.now() + durationMs);
            permissionToken.expireAt = expiredAt;
            permissionToken.group = group;
            const result = generatePermissionToken(
              state.game.state.settings.permissionTokenSecret,
              permissionToken,
            );
            const inviteLink = InviteLinkSchema.clone(
              InviteLinkSchema.identity,
            );
            inviteLink.tokenString = result;
            inviteLink.expiredAt = expiredAt;
            this._state.replica.inviteLink.push(inviteLink);
            this._logger.info(
              `generated permission token for group ${group} with duration ${durationMs}.  expires at ${permissionToken.expireAt}. token=${result}`,
            );
            PermissionTokenSchema.free(permissionToken);
            return client.message.rpcResponse({
              token,
              result,
              error: result ? '' : 'invalid token request',
            });
          } else {
            this._logger.info(
              'invalid request token call from ' + client.sessionId,
            );
            return client.message.rpcResponse({
              token,
              result: '',
              error: 'edit permissions not allowed',
            });
          }
        },

        clearNewApplicants: (client) => {
          const applicants = this._state.replica.newApplicants;
          for (const id in applicants) {
            delete applicants[id];
          }
          this._protocol.broadcast.updateNewApplicants(applicants);
        },

        applyForEditing: (client) => {
          const connection =
            this._state.game.state.connections[client.sessionId];
          if (!connection) {
            this._state.logger.error('invalid edit application request');
            return;
          }
          const userId = connection.sessionData.user.id;
          if (!userId) {
            this._state.logger.error('guest applying for edit privileges');
            return;
          }

          if (this._state.replica.applications.indexOf(userId) >= 0) {
            this._state.logger.error('user applied twice');
            return;
          }

          this._state.replica.applications.push(userId);
          this._protocol.broadcast.updateApplications(
            this._state.replica.applications,
          );

          this._state.replica.newApplicants[userId] = true;
          this._protocol.broadcast.updateNewApplicants(
            this._state.replica.newApplicants,
          );
        },

        acceptApplication: async (client, id) => {
          const permissions = this.getSessionPermissions(client.sessionId);
          if (!permissions || !permissions.editPermissions) {
            this._state.logger.error(
              'invalid attempt to edit permissions from ' + client.sessionId,
            );
            return;
          }

          this._state.logger.info(
            `accept application from ${id} by ${client.sessionId}`,
          );

          const idx = this._state.replica.applications.indexOf(id);
          if (idx < 0) {
            return;
          }

          const connections = this._state.game.state.connectionSet;
          for (let i = 0; i < connections.length; ++i) {
            if (connections[i].sessionData.user.id === id) {
              const otherClient =
                this._protocol.clients[connections[i].sessionId];
              if (otherClient) {
                otherClient.message.applicationAccepted();
              }
            }
          }
          // add to collaborators
          if (
            this._state.replica.permissions.collaborators.indexOf(id) === -1
          ) {
            await this.permissionTransaction()
              .push((action) => action.collaborators.push(id))
              .commit();
          }
          this._state.replica.applications.splice(idx, 1);
          this._protocol.broadcast.updateApplications(
            this._state.replica.applications,
          );

          delete this._state.replica.newApplicants[id];
          this._protocol.broadcast.updateNewApplicants(
            this._state.replica.newApplicants,
          );
        },
        rejectApplication: (client, id) => {
          const permissions = this.getSessionPermissions(client.sessionId);
          if (!permissions || !permissions.editPermissions) {
            this._state.logger.error(
              'invalid attempt to edit permissions from ' + client.sessionId,
            );
            return;
          }

          this._state.logger.info(
            `reject application from ${id} by ${client.sessionId}`,
          );

          const idx = this._state.replica.applications.indexOf(id);

          if (idx < 0) {
            return;
          }

          this._state.replica.applications.splice(idx, 1);
          this._protocol.broadcast.updateApplications(
            this._state.replica.applications,
          );

          delete this._state.replica.newApplicants[id];
          this._protocol.broadcast.updateNewApplicants(
            this._state.replica.newApplicants,
          );
        },
        inviteLinkExpired: (client, tokenString) => {
          const isLinkAccess = this._state.replica.inviteLink.find(
            (link) => link.tokenString === tokenString,
          );
          if (isLinkAccess && isLinkAccess.expiredAt < new Date()) {
            this._state.replica.inviteLink =
              this._state.replica.inviteLink.filter(
                (link) => link.tokenString !== tokenString,
              );
            client.message.inviteLinkExpired(true);
            return;
          }
          client.message.inviteLinkExpired(false);
        },
        inviteLinkGroup: (client, { token, linkString }) => {
          let group = '';
          const res = parsePermissionToken(
            this._state.game.state.settings.permissionTokenSecret,
            linkString,
          );
          if (res) {
            group = res.group;
          }
          client.message.inviteLinkGroup(group);
          return client.message.rpcResponse({
            token,
            result: group,
            error: '',
          });
        },

        addCollaborator: async (client, params) => {
          this._logger.info(
            `add collaborator for client: ${client.sessionId} for user: ${params.id}`,
          );
          if (params.id === replicaState.permissions.owner) {
            this._logger.info(`owner is not collaborator`);
            return;
          }
          const index = replicaState.permissions.collaborators.indexOf(
            params.id,
          );
          if (index >= 0) {
            this._logger.info(`add collaborator fail: exist id in list`);
          } else {
            await this.permissionTransaction()
              .push((action) => action.collaborators.push(params.id))
              .commit();
          }
          await this.permissionTransaction()
            .push((action) =>
              action.groups.update(params.group).members.set(params.id, {
                addedAt: new Date(),
              }),
            )
            .commit();
        },
        cancelCollaborator: async (client, id) => {
          this._logger.info(
            `cancel collabortor for client: ${client.sessionId} for user: ${id}`,
          );
          const index = replicaState.permissions.collaborators.indexOf(id);
          if (index === -1) {
            this._logger.info(`cancel collaborator fail: no found id in list`);
            return;
          }
          const roles: string[] = [];
          const groupNames = Object.keys(replicaState.permissions.groups);
          for (let i = 0; i < groupNames.length; i++) {
            if (replicaState.permissions.groups[groupNames[i]].members[id]) {
              roles.push(groupNames[i]);
            }
          }
          for (const permission of roles) {
            await this.permissionTransaction()
              .push((action) =>
                action.groups.update(permission).members.remove(id),
              )
              .commit();
          }
          await this.permissionTransaction()
            .push((action) => action.collaborators.splice(index, 1))
            .push((action) =>
              action.groups.update('guest').members.set(id, {
                addedAt: new Date(),
              }),
            )
            .commit();
        },
      },

      connect: async (client) => {
        const initPacket = EditReplicaInitSchema.alloc();
        ExtraProjectInfoSchema.assign(
          initPacket.extraProjectInfo,
          replicaState.extraProjectInfo,
        );
        this._logger.debug(
          `wait to lock project state to initialize client ${client.sessionId}...`,
        );
        const projectMutex = this._projectSemaphore.p();
        this._logger.debug(
          `wait to lock permission state to initialize client ${client.sessionId}...`,
        );
        const permissionMutex = this._permissionSemaphore.p();
        try {
          await permissionMutex;
          this._logger.debug(
            `permission state locked to initialize client ${client.sessionId}...`,
          );
          await projectMutex;
          this._logger.debug(
            `project state locked to initialize client ${client.sessionId}...`,
          );
          replicaState.projectStore.serialize(ProjectRDA, initPacket.project);
          replicaState.permissionStore.serialize(
            PermissionRDA,
            initPacket.permissions,
          );
          client.message.init(initPacket);
        } finally {
          this._permissionSemaphore.v();
          this._logger.debug(
            `permission state unlocked since client ${client.sessionId} initialize ended`,
          );
          this._projectSemaphore.v();
          this._logger.debug(
            `project state unlocked since client ${client.sessionId} initialize ended`,
          );
          EditReplicaInitSchema.free(initPacket);
        }
        client.message.updateApplications(this._state.replica.applications);
        client.message.updateNewApplicants(this._state.replica.newApplicants);
        // 检测是否需要更新extraProject
        this._checkAndSetExtraProject();
      },
    });
  }

  private _handleGroupProjectReconnect = () => {
    // 重连时，重新发起Channel.ENGINE_CUSTOM的订阅，所以会收到ONLINE_CONNECTION的消息
    this._state.game.webSocket.onMessage(async (data: string) => {
      const message: ReceivedMsg = JSON.parse(data);
      if (
        message.opcode !== OPCode.Dispatch ||
        message.event !== 'ONLINE_CONNECTION'
      ) {
        return;
      }

      const { project: originProject } = this._state.replica;
      const project = ProjectRDA.stateSchema.clone(originProject);

      const {
        pendingActions,
        store: groupProjectStore,
        metaData: groupProjectMetaData,
      } = await getGroupProjectBySocket({
        backendSocket: this._state.game.webSocket,
        logger: this._logger,
        message: data,
        bs: this._state.buildSystem,
      });

      try {
        this._logger.info(`wait to lock project state to update store...`);
        await this._projectSemaphore.p();
        this._logger.info(`project state locked to update store...`);

        // 有store直接使用其它容器store
        if (groupProjectStore) {
          updateProjectStoreByGroupProject(
            this._state.replica.projectStore,
            groupProjectStore,
          );
        } else if (groupProjectMetaData) {
          // 没用state使用数据库保存的数据
          await Promise.all(
            Object.keys(groupProjectMetaData.hashes).map(async (item) => {
              project[item] = await this._state.buildSystem.retrieveJSON(
                groupProjectMetaData.hashes[item],
              );
            }),
          );
          this._state.replica.projectStore.free(ProjectRDA);
          this._state.replica.projectStore = ProjectRDA.createStore(project);
        }

        // apply 初始化期间收到的actions
        for (let i = 0; i < pendingActions.length; ++i) {
          for (let j = 0; j < pendingActions[i].length; ++j) {
            this._state.replica.projectStore.apply(
              ProjectRDA,
              pendingActions[i][j],
            );
          }
        }

        const replicaState = this._state.replica;

        // resetStore to client
        const storeState = replicaState.projectStore.serialize(
          ProjectRDA,
          ProjectStoreSchema.alloc(),
        );
        this._protocol.broadcast.reset(storeState);
        ProjectStoreSchema.free(storeState);

        // reset state
        replicaState.project = replicaState.projectStore.state(
          ProjectRDA,
          replicaState.project,
        );
      } finally {
        this._projectSemaphore.v();
        this._logger.info(`project state unlocked since update store ended`);
      }

      this._sendGroupProjectReady();
      this._setProjectDirty();
    });
  };

  private _subscribeGroupProjectActions = () => {
    this._state.game.webSocket.onMessage(async (data: string) => {
      const message: ReceivedMsg = JSON.parse(data);
      if (
        message.opcode === OPCode.Dispatch &&
        message.event === 'BROADCAST' &&
        message.data.type === BroadcastDataType.ACTION
      ) {
        this._logger.info(
          `receive actions from other server, actions length is ${message.data.payload.length} `,
        );
        this._applyProjectTransaction(message.data.payload);
      }
    });
  };

  private _sendGroupProjectReady() {
    this._logger.info(`SHARE_STATE: send ready`);
    this._state.game.webSocket.send(generateEngineReadyMsg());
  }

  private _rollbackProject = (
    client: ReplicaRemoteClient,
    actions: ProjectAction[],
  ) => {
    const store = this._state.replica.projectStore;
    const inverse = ProjectActionSequenceSchema.alloc();
    for (let i = actions.length - 1; i >= 0; --i) {
      inverse.push(store.inverse(ProjectRDA, actions[i]));
    }
    client.message.project(inverse);
    ProjectActionSequenceSchema.free(inverse);
  };

  private _applyProjectTransaction = async (actions: ProjectAction[]) => {
    this._logger.debug('Locking project state to apply update...');
    await this._projectSemaphore.p();
    this._logger.debug('Project state locked to apply update...');
    try {
      const replicaState = this._state.replica;
      const store = replicaState.projectStore;
      for (let i = 0; i < actions.length; ++i) {
        store.apply(ProjectRDA, actions[i]);
      }
      this._setProjectDirty();
      this._syncLocalProjectModelMembership();
      this._protocol.broadcast.project(actions);
    } catch (e) {
      this._logger.error(`error updating project: ${e}`);
    } finally {
      this._projectSemaphore.v();
      this._logger.debug('Project state unlocked since update apply ended.');
    }
  };

  private _rollbackVoxel = (
    client: ReplicaRemoteClient,
    writes: VoxelWrite[],
  ) => {
    const voxels = this._state.game.voxel;
    const inverse = VoxelWriteSequenceSchema.alloc();
    for (let i = 0; i < writes.length; ++i) {
      const m = VoxelWriteSchema.clone(writes[i]);
      m.b = voxels.getVoxel(m.x, m.y, m.z);
      inverse.push(m);
    }
    client.message.voxel(inverse);
    VoxelWriteSequenceSchema.free(inverse);
  };

  // updates tthe voxels
  private _applyVoxelTransaction = (writes: VoxelWrite[]) => {
    const voxels = this._state.game.voxel;
    for (let i = 0; i < writes.length; ++i) {
      const w = writes[i];
      voxels.setVoxel(w.x, w.y, w.z, w.b);
    }
  };

  // rollsback a permission update on a single client
  private _rollbackPermissions = (
    client: ReplicaRemoteClient,
    actions: PermissionAction[],
  ) => {
    const store = this._state.replica.permissionStore;
    const inverse = PermissionActionSequenceSchema.alloc();
    for (let i = actions.length - 1; i >= 0; --i) {
      inverse.push(store.inverse(PermissionRDA, actions[i]));
    }
    client.message.permissions(inverse);
    PermissionActionSequenceSchema.free(inverse);
  };

  // permission transactions have enforced durability guarantees, project transactions are a bit flimsier
  private _applyPermissionTransaction = async (actions: PermissionAction[]) => {
    this._logger.debug('Locking permission state to apply update...');
    await this._permissionSemaphore.p();
    this._logger.debug('Permission state locked to apply update...');
    try {
      const replicaState = this._state.replica;
      const store = replicaState.permissionStore;

      // broadcast update to clients
      this._protocol.broadcast.permissions(actions);

      // update store
      for (let i = 0; i < actions.length; ++i) {
        store.apply(PermissionRDA, actions[i]);
      }

      // update state
      store.state(PermissionRDA, replicaState.permissions);
      this._updatePermissionsIndex();

      // set container dirty flag
      this._setPermissionsDirty();
    } catch (e) {
      this._logger.error(`error updating permissions: ${JSON.stringify(e)}`);
    } finally {
      this._permissionSemaphore.v();
      this._logger.debug('Permission state unlocked since update ended');
    }
  };

  public projectTransaction() {
    return new RDATransaction(
      ProjectRDA,
      this._state.replica.projectStore,
      this._applyProjectTransaction,
    );
  }

  public permissionTransaction() {
    return new RDATransaction(
      PermissionRDA,
      this._state.replica.permissionStore,
      this._applyPermissionTransaction,
    );
  }

  public isUserBlocked(userId: string) {
    const permissions = this._state.replica.permissions;

    // check if userId is an admin
    if (this._state.replica.adminUsers[userId]) {
      return false;
    }

    // owner is always allowed
    if (userId === permissions.owner) {
      return false;
    }
    // banned users never allowed
    if (permissions.banned[userId]) {
      return true;
    }

    switch (permissions.accessLevel) {
      case PermissionAccessLevel.PRIVATE:
        return true;
      case PermissionAccessLevel.INVITED_ONLY:
        const groups = permissions.groups;
        const groupRoles = Object.keys(groups);
        for (let i = 0; i < groupRoles.length; ++i) {
          const g = groups[groupRoles[i]];
          if (userId in g.members) {
            return false;
          }
        }
        return true;
      case PermissionAccessLevel.REGISTERED_ONLY:
        return !userId;
      case PermissionAccessLevel.SCRIPT_VIEW_ONLY:
        return false;
    }

    return true;
  }

  public blockReason = (userId: string) => {
    const permissions = this._state.replica.permissions;
    if (
      permissions.banned[userId] ||
      permissions.accessLevel === PermissionAccessLevel.PRIVATE
    ) {
      return CloseType.NoAuth;
    }
    if (!userId) {
      return CloseType.NeedLogin;
    }
    return CloseType.Server;
  };

  public handleUserJoin = async (
    sessionId: string,
    userId: string,
    admin: boolean,
  ) => {
    const replicaState = this._state.replica;
    const permissions = replicaState.permissions;

    if (admin) {
      replicaState.adminUsers[userId] = admin;
    }

    if (this.isUserBlocked(userId)) {
      this._logger.info(
        `blocked user attempted to join, ${userId}/session id=${sessionId}`,
      );
      const reason = this.blockReason(userId);
      return { canJoin: false, reason };
    }

    if (!userId) {
      return { canJoin: true };
    }

    // update permission from user access
    const tx = this.permissionTransaction();
    if (!permissions.users[userId]) {
      tx.push((action) =>
        action.users.set(userId, {
          createdAt: new Date(),
        }),
      );
      const defaultGroups = replicaState.defaultGroups;
      for (let i = 0; i < defaultGroups.length; ++i) {
        tx.push((action) =>
          action.groups.update(defaultGroups[i]).members.set(userId, {
            addedAt: new Date(),
          }),
        );
      }
    }
    await tx.commit();

    return { canJoin: true };
  };

  private _handlePlayRPC(
    method: () => Promise<void>,
    client: ReplicaRemoteClient,
    token: number,
  ) {
    if (!this.getSessionPermissions(client.sessionId).playButton) {
      this._logger.warn(
        `invalid play rpc request from client ${client.sessionId}`,
      );
      client.message.rpcResponse({
        token,
        result: '',
        error: 'play button not allowed',
      });
    } else {
      this._logger.info(`rpc call ${token} from client ${client.sessionId}`);
      method
        .call(this)
        .then((hash) => {
          this._logger.info(`success`);
          client.message.rpcResponse({
            token,
            result: 'success',
            error: '',
          });
        })
        .catch((e) => {
          this._logger.error('RPC failed: ' + e.stack);
          client.message.rpcResponse({
            token,
            result: '',
            error: `${e.message}: ${e.stack}`,
          });
        });
    }
  }

  // because this happens *all the time* we need state updates here to be fast
  // so we do some dirty hacks to directly update game state in game synchronously
  // this is only possible when the game is not running and no other synchronization operations
  // are in progress
  private _quickSyncProjectHack() {
    const replicaState = this._state.replica;
    const store = replicaState.projectStore;
    const project = store.state(ProjectRDA, replicaState.project);

    // hack: directly update game state
    const game = this._state.game;
    const gameState = game.state;
    EnvironmentRDA.stateSchema.assign(
      gameState.replica.environment,
      project.environment,
    );

    const hotProject = gameState.project;
    EnvironmentRDA.stateSchema.assign(
      hotProject.environment,
      project.environment,
    );
    PhysicsRDA.stateSchema.assign(hotProject.physics, project.physics);
    PlayerRDA.stateSchema.assign(hotProject.player, project.player);
    updateHotProjectAssets(hotProject, project);
    AmbientSoundRDA.stateSchema.assign(hotProject.sound, project.ambientSound);
    GamepadRDA.stateSchema.assign(hotProject.gamepad, project.gamepad);
    copySoundAssets(hotProject);
    // set sync flag in game, force it to update game state
    gameState.replica.sync = true;
    gameState.sync = true;

    // clear dirty flag
    replicaState.projectDirty = false;
  }

  public tick() {
    // check if we can do an optimisitic state synchronization
    const replicaState = this._state.replica;
    const gameState = this._state.game.state;
    const now = Date.now();
    if (
      getConfigSync()?.method === 'local' &&
      process.env.BOX_GROUP_PROJECT_STATE_PATH &&
      now >= this._nextLocalExtraProjectCheck
    ) {
      this._nextLocalExtraProjectCheck = now + 1_000;
      const groupExtraProjectHash = getLocalExtraProjectStateHash();
      if (
        groupExtraProjectHash &&
        groupExtraProjectHash !== this._observedLocalExtraProjectHash &&
        !this._localExtraProjectRefreshPending
      ) {
        this._localExtraProjectRefreshPending = true;
        this._checkAndSetExtraProject()
          .catch((error) =>
            this._logger.error(
              `error refreshing map group resources: ${String(error)}`,
            ),
          )
          .finally(() => {
            this._localExtraProjectRefreshPending = false;
          });
      }
    }
    if (
      replicaState.projectDirty &&
      0 < this._projectSemaphore.counter &&
      !this._state.game.syncInProgress() &&
      !gameState.replica.running
    ) {
      this._quickSyncProjectHack();
    }

    // apply any buffered voxel writes
    const bufferedWrites = replicaState.bufferedVoxelWrites;
    if (bufferedWrites.length > 0 && this._canUpdateVoxels()) {
      const voxels = this._state.game.voxel;
      for (let i = 0; i < bufferedWrites.length; ++i) {
        const w = bufferedWrites[i];
        voxels.setVoxel(w.x, w.y, w.z, w.b);
        VoxelWriteSchema.free(w);
      }
      bufferedWrites.length = 0;
    }

    // auto back up
    if (
      replicaState.lastAutoSave + gameState.settings.autoSaveInterval <
      gameState.clock.clock
    ) {
      this.saveProject().catch((e) =>
        this._logger.error(`error auto-saving project ${e}`),
      );
    }

    // update permissions
    if (
      (gameState.events.connect.length > 0 ||
        gameState.events.disconnect.length > 0) &&
      this._permissionSemaphore.counter > 0
    ) {
      this._updatePermissionsIndex();
    }
  }

  // save voxel, script and hash links into project
  private async _storeProject() {
    // start saving big content
    const loadScripts = this._codeEditorController.saveScripts();

    // set up stuff
    const replicaState = this._state.replica;
    const store = replicaState.projectStore;
    const actions: ProjectAction[] = [];
    let sharedScriptsDirty = false;
    const { contentId } = getConfigSync();

    // update voxel hashes only if game isn't running
    const gameState = this._state.game.state;
    if (!gameState.replica.running) {
      const voxels = await recordVoxelInfo(gameState);
      if (voxels) {
        if (
          voxels.chunks.length ===
            (voxels.shape.x * voxels.shape.y * voxels.shape.z) >>
              (3 * CHUNK_SHIFT) &&
          voxels.chunks.indexOf('') < 0 &&
          !VoxelRDA.stateSchema.equal(voxels, replicaState.project.voxels)
        ) {
          actions.push(ProjectRDA.action(store).voxels(voxels));
        }
        VoxelRDA.stateSchema.free(voxels);
      } else {
        this._logger.error(`error saving voxels`);
      }
    }

    // update script hashes
    const scriptUpdates = await loadScripts;
    for (let i = 0; i < scriptUpdates.length; ++i) {
      const { name, hash, size, isClient, isShare, fileId } = scriptUpdates[i];
      const prevAsset = replicaState.project.assets[name];
      if (isShare) {
        const shared = replicaState.extraProjectInfo.scriptAssets[fileId];
        if (shared && (shared.hash !== hash || shared.name !== name)) {
          shared.hash = hash;
          shared.name = name;
          shared.isClient = isClient;
          shared.isShare = true;
          shared.lockedMapId = 0;
          shared.lockedMapTitle = '';
          sharedScriptsDirty = true;
        }
        continue;
      }
      if (
        prevAsset &&
        (prevAsset.type === AssetType.JS_SCRIPT ||
          prevAsset.type === AssetType.CLIENT_JS_SCRIPT)
      ) {
        if (prevAsset.hash !== hash) {
          actions.push(ProjectRDA.action(store).assets.update(name).hash(hash));
          actions.push(ProjectRDA.action(store).assets.update(name).size(size));
        }
      } else {
        actions.push(
          ProjectRDA.action(store).assets.set(name, {
            type: isClient ? AssetType.CLIENT_JS_SCRIPT : AssetType.JS_SCRIPT,
            hash,
            previewImage: '',
            size,
            contentId: 0,
            ownerId: 0,
            bounds: vec3.create(),
            animated: false,
          }),
        );
      }
    }

    if (sharedScriptsDirty && getConfigSync()?.method === 'local') {
      const stream = new MuWriteStream(1);
      ExtraProjectInfoSchema.diff(
        ExtraProjectInfoSchema.identity,
        replicaState.extraProjectInfo,
        stream,
      );
      const extraProjectHash = await this._state.contentServer.store(
        stream.bytes(),
      );
      stream.destroy();
      persistLocalProjectState(replicaState.permissionHash, extraProjectHash);
      replicaState.hotProjectDirty = true;
    }

    if (actions.length > 0) {
      // add action
      actions.push(ProjectRDA.action(store).prevHash(replicaState.projectHash));
      actions.push(ProjectRDA.action(store).timestamp(new Date()));

      // broadcast update to clients
      this._protocol.broadcast.project(actions);

      // set a bunch of dirty flags
      replicaState.permissionsDirty =
        replicaState.permissionsHashDirty =
        replicaState.hotProjectDirty =
        replicaState.projectHashDirty =
          true;
    }

    // apply to local store and clean up
    for (let i = 0; i < actions.length; ++i) {
      store.apply(ProjectRDA, actions[i]);
      ProjectActionSchema.free(actions[i]);
    }

    // update project
    store.state(ProjectRDA, replicaState.project);
    this._syncLocalProjectModelMembership();

    // clear dirty flag for project reference
    replicaState.projectDirty = false;
  }

  private async _updateProjectAndGroupProject(storeRes: StoreProjectRes) {
    const { projectHash, groupProjectMetaData } = storeRes;
    if (projectHash) {
      await this._updateProjectHash(projectHash);
    }
    if (getConfigSync()?.method === 'local' && groupProjectMetaData) {
      persistLocalGroupProjectMetaData(groupProjectMetaData);
    }
  }

  private async _updateProjectHash(
    hash: string,
    currentBranch: string = DEFAULT_BRANCH,
  ) {
    // store project hash
    const replicaState = this._state.replica;
    if (
      replicaState.projectHash === hash &&
      replicaState.permissions.versionControl.branches[currentBranch]
        .headHash === hash
    ) {
      this._state.logger.info('project hash unchanged, skip');
      return;
    }
    // mark permission state as dirty
    this._setPermissionsDirty();

    // set project hash pointer
    replicaState.projectHash = hash;
    replicaState.projectHashDirty = false;

    // update version constrol structure
    const permissionActions = PermissionActionSequenceSchema.alloc();
    const permissionStore = replicaState.permissionStore;

    // update head
    const setHash = PermissionRDA.action(
      permissionStore,
    ).versionControl.branches.set(currentBranch, {
      ...replicaState.permissions.versionControl.branches[currentBranch],
      headHash: hash,
    });
    permissionStore.apply(PermissionRDA, setHash);
    permissionActions.push(setHash);

    // update hash link
    const updatePrevHash = PermissionRDA.action(permissionStore).prevHash(
      replicaState.permissionHash,
    );
    permissionStore.apply(PermissionRDA, updatePrevHash);
    permissionActions.push(updatePrevHash);

    // update timestamp
    const updateTimestamp = PermissionRDA.action(permissionStore).timestamp(
      new Date(),
    );
    permissionStore.apply(PermissionRDA, updateTimestamp);
    permissionActions.push(updateTimestamp);

    // synchronize permission structures
    this._protocol.broadcast.permissions(permissionActions);
    PermissionActionSequenceSchema.free(permissionActions);

    // update permission state
    const permissionState = permissionStore.state(
      PermissionRDA,
      replicaState.permissions,
    );
    this._updatePermissionsIndex();

    // update permission structure hash
    const permissionHash = await storePermissions(
      this._state.buildSystem,
      permissionState,
    );
    if (!permissionHash) {
      this._logger.warn('error updating permission hash');
      return;
    }
    replicaState.permissionHash = permissionHash;
    replicaState.permissionsDirty = false;

    // update container state
    replicaState.lastAutoSave = this._state.game.state.clock.clock;
    try {
      await this._savePermissions();
    } catch (e) {
      this._logger.error(
        `error updating backend: ${e.message} ${e.stack} ${JSON.stringify(e)}`,
      );
      throw new Error('error updating backend.  changes not saved');
    }

    // log result
    this._logger.info(`permission hash updated = ${permissionHash}`);
  }

  private async _syncPermissions() {
    // store project hash
    const replicaState = this._state.replica;

    // update version constrol structure
    const permissionActions = PermissionActionSequenceSchema.alloc();
    const permissionStore = replicaState.permissionStore;

    // update hash link
    const updatePrevHash = PermissionRDA.action(permissionStore).prevHash(
      replicaState.permissionHash,
    );
    permissionStore.apply(PermissionRDA, updatePrevHash);
    permissionActions.push(updatePrevHash);

    const updateTimestamp = PermissionRDA.action(permissionStore).timestamp(
      new Date(),
    );
    permissionStore.apply(PermissionRDA, updateTimestamp);
    permissionActions.push(updateTimestamp);

    //synchronize permission structures
    this._protocol.broadcast.permissions(permissionActions);
    PermissionActionSequenceSchema.free(permissionActions);

    // update permission state
    const permissionState = permissionStore.state(
      PermissionRDA,
      replicaState.permissions,
    );
    this._updatePermissionsIndex();

    // update permission structure hash
    const permissionHash = await storePermissions(
      this._state.buildSystem,
      permissionState,
    );
    if (!permissionHash) {
      this._logger.warn('error updating permission hash');
      return;
    }
    replicaState.permissionHash = permissionHash;
    replicaState.permissionsDirty = false;

    // update container state
    replicaState.lastAutoSave = this._state.game.state.clock.clock;
    try {
      await this._savePermissions();
    } catch (e) {
      this._logger.error(
        `error updating backend: ${e.message} ${e.stack} ${JSON.stringify(e)}`,
      );
      throw new Error('error updating backend.  changes not saved');
    }

    // log result
    this._logger.info(`permission hash updated = ${permissionHash}`);
  }

  private _setBusyState(busy: boolean) {
    this._protocol.broadcast.updateBusyState(busy);
  }

  public _checkAndSetExtraProject = async () => {
    const localLibrary = await getExtraProject(
      this._state.publish.gameId,
      'edit',
      this._logger,
    );

    const replicaState = this._state.replica;
    // boxes refreshes a complete authoritative snapshot. Local VOXA only
    // supplies the shared local models and skins, so imported projects must
    // retain their packaged cloud snapshot and merge the live local library
    // into it instead of replacing one source with the other.
    const embeddedLocalProject =
      getConfigSync()?.method === 'local' &&
      (getLocalExtraProjectMode() === 'embedded' ||
        Boolean(process.env.BOX_GROUP_PROJECT_STATE_PATH));
    let extra = localLibrary;
    if (embeddedLocalProject) {
      // The group root is authoritative for shared resources, including
      // deletions. Do not merge VOXA into this container's previous replica:
      // an already-open submap would otherwise resurrect a script that the
      // main map removed from the group snapshot.
      const authoritativeHash = getLocalExtraProjectStateHash();
      let authoritative = replicaState.extraProjectInfo;
      if (authoritativeHash) {
        const bytes = await this._state.contentServer.retrieve(
          authoritativeHash,
        );
        if (!bytes) {
          throw new Error(
            `map group resource snapshot is missing: ${authoritativeHash}`,
          );
        }
        authoritative = decodeExtraProjectInfo(bytes);
      }
      extra = mergeExtraProjectInfo(
        authoritative,
        localLibrary,
        new Set(getDeletedLocalProjectModelPaths()),
      );
    }
    const previousExtra = ExtraProjectInfoSchema.clone(
      replicaState.extraProjectInfo,
    );
    const stream = new MuWriteStream(1);
    const diff = ExtraProjectInfoSchema.diff(
      replicaState.extraProjectInfo,
      extra,
      stream,
    );
    if (diff) {
      replicaState.hotProjectDirty = true;
      const bytes = stream.bytes();
      this._protocol.broadcastRaw(bytes);
      replicaState.extraProjectInfo = ExtraProjectInfoSchema.patch(
        replicaState.extraProjectInfo,
        new MuReadStream(bytes),
      );
      await this._codeEditorController.resyncFiles(
        replicaState.extraProjectInfo.scriptAssets,
        previousExtra.scriptAssets,
      );
      this._logger.info('update extra project info');

      const persistedStream = new MuWriteStream(1);
      ExtraProjectInfoSchema.diff(
        ExtraProjectInfoSchema.identity,
        replicaState.extraProjectInfo,
        persistedStream,
      );
      const extraProjectHash = await this._state.contentServer.store(
        persistedStream.bytes(),
      );
      persistedStream.destroy();
      persistLocalProjectState(
        replicaState.permissionHash,
        extraProjectHash,
      );
      await this._updateProjectByExtra();
    } else {
      // No asset snapshot changed, but an entity can still retain the old path
      // of a renamed local VOXA model. Repair only that narrow case here;
      // running a full modelId refresh would also include legacy modelId=0
      // assets and could remap unrelated imported models.
      await this._updateProjectByExtra(true);
    }
    ExtraProjectInfoSchema.free(previousExtra);
    this._observedLocalExtraProjectHash = getLocalExtraProjectStateHash();
    stream.destroy();
  };

  public updateLocalProjectSkin = async (input: LocalProjectSkinAction) => {
    if (
      getConfigSync()?.method !== 'local' ||
      (getLocalExtraProjectMode() !== 'embedded' &&
        !process.env.BOX_GROUP_PROJECT_STATE_PATH)
    ) {
      throw new Error('project skins are only editable in an embedded local project');
    }
    const name = 'name' in input ? String(input.name || '').trim() : '';
    if (input.action !== 'create' && !name) {
      throw new Error('skin name is required');
    }

    const replicaState = this._state.replica;
    // Another map can unshare a file between this editor's last refresh and
    // its delayed auto-save. Always begin with the map group's current root;
    // cloning this runtime's stale replica would write the removed entry back
    // and make it reappear in every map.
    const authoritativeHash = getLocalExtraProjectStateHash();
    let authoritative = replicaState.extraProjectInfo;
    let decodedAuthoritative: ExtraProjectInfo | undefined;
    if (
      authoritativeHash &&
      authoritativeHash !== this._observedLocalExtraProjectHash
    ) {
      const bytes = await this._state.contentServer.retrieve(authoritativeHash);
      if (!bytes) {
        throw new Error(
          `map group resource snapshot is missing: ${authoritativeHash}`,
        );
      }
      decodedAuthoritative = decodeExtraProjectInfo(bytes);
      authoritative = decodedAuthoritative;
    }
    const extra = ExtraProjectInfoSchema.clone(authoritative);
    decodedAuthoritative && ExtraProjectInfoSchema.free(decodedAuthoritative);
    if (input.action !== 'create' && !extra.skinAssets[name]) {
      throw new Error('skin not found');
    }

    let nextName = name;
    if (input.action === 'create') {
      nextName = String(input.newName || '').trim().slice(0, 100);
      if (!nextName) throw new Error('new skin name is required');
      if (extra.skinAssets[nextName]) throw new Error('skin name already exists');
      const hash = String(input.modelFileHash || '').trim();
      if (!hash) throw new Error('skin model hash is required');
      extra.skinAssets[nextName] = { hash };
    } else if (input.action === 'setDefault') {
      extra.defaultSkinName = name;
    } else if (input.action === 'unsetDefault') {
      if (extra.defaultSkinName === name) extra.defaultSkinName = '';
    } else if (input.action === 'rename' || input.action === 'update') {
      nextName = String(input.newName || '').trim().slice(0, 100);
      if (!nextName) throw new Error('new skin name is required');
      if (nextName !== name && extra.skinAssets[nextName]) {
        throw new Error('skin name already exists');
      }
      const asset =
        input.action === 'update'
          ? { hash: String(input.modelFileHash || '').trim() }
          : extra.skinAssets[name];
      if (!asset.hash) throw new Error('skin model hash is required');
      if (nextName !== name) delete extra.skinAssets[name];
      extra.skinAssets[nextName] = asset;
      if (extra.defaultSkinName === name) extra.defaultSkinName = nextName;
    } else if (input.action === 'delete') {
      delete extra.skinAssets[name];
      if (extra.defaultSkinName === name) extra.defaultSkinName = '';
    }

    updateLocalProjectSkinMetadata(({ skinPreviews, skinProjects }) => {
      const previousPreview = skinPreviews[name];
      const previousProject = skinProjects[name];
      if (input.action === 'delete') {
        delete skinPreviews[name];
        delete skinProjects[name];
        return;
      }
      if (
        input.action === 'create' ||
        input.action === 'rename' ||
        input.action === 'update'
      ) {
        if (nextName !== name) {
          delete skinPreviews[name];
          delete skinProjects[name];
        }
        const previewHash =
          input.action === 'create' || input.action === 'update'
            ? input.previewHash
            : previousPreview;
        const projectFileHash =
          input.action === 'create' || input.action === 'update'
            ? input.projectFileHash
            : previousProject;
        if (previewHash) skinPreviews[nextName] = previewHash;
        if (projectFileHash) skinProjects[nextName] = projectFileHash;
      }
    });

    const stream = new MuWriteStream(1);
    const diff = ExtraProjectInfoSchema.diff(
      replicaState.extraProjectInfo,
      extra,
      stream,
    );
    if (diff) {
      replicaState.hotProjectDirty = true;
      const bytes = stream.bytes();
      this._protocol.broadcastRaw(bytes);
      replicaState.extraProjectInfo = ExtraProjectInfoSchema.patch(
        replicaState.extraProjectInfo,
        new MuReadStream(bytes),
      );

      const persistedStream = new MuWriteStream(1);
      ExtraProjectInfoSchema.diff(
        ExtraProjectInfoSchema.identity,
        replicaState.extraProjectInfo,
        persistedStream,
      );
      const extraProjectHash = await this._state.contentServer.store(
        persistedStream.bytes(),
      );
      persistedStream.destroy();
      persistLocalProjectState(replicaState.permissionHash, extraProjectHash);
    }
    stream.destroy();
    return {
      skinPreviews: getLocalProjectSkinPreviews(),
      skinProjects: getLocalProjectSkinProjects(),
    };
  };

  public updateLocalProjectModel = async (input: LocalProjectModelAction) => {
    if (
      getConfigSync()?.method !== 'local' ||
      (getLocalExtraProjectMode() !== 'embedded' &&
        !process.env.BOX_GROUP_PROJECT_STATE_PATH)
    ) {
      throw new Error('project models are only editable in an embedded local project');
    }
    const name = 'name' in input ? String(input.name || '').trim() : '';
    const extra = ExtraProjectInfoSchema.clone(this._state.replica.extraProjectInfo);
    const requestedPath = 'meshPath' in input
      ? String(input.meshPath || '').trim()
      : '';
    const entry = input.action === 'create' || input.action === 'restore' || input.action === 'purge'
      ? undefined
      : Object.entries(extra.meshAssets).find(
          ([path]) => path === (requestedPath || getMeshPath(name)),
        );
    if (
      input.action !== 'create' &&
      input.action !== 'restore' &&
      input.action !== 'purge' &&
      !entry
    ) throw new Error('model not found');
    const [path, asset] = entry || ['', undefined];
    const storedName = path.replace(/^mesh\//, '').replace(/\.vb$/, '');
    const deleteAssets = DeleteAssetsRDA.stateSchema.clone(
      this._state.replica.project.deleteAssets,
    );
    let updateTrash = false;
    if (input.action === 'create') {
      const newName = String(input.newName || '').trim().slice(0, 100);
      const nextPath = getMeshPath(newName);
      if (!newName) throw new Error('new model name is required');
      if (extra.meshAssets[nextPath]) throw new Error('model name already exists');
      const hash = String(input.modelFileHash || '').trim();
      if (!isContentHash(hash)) throw new Error('model hash is invalid');
      extra.meshAssets[nextPath] = {
        modelId: Number(input.modelId),
        hash,
        modelPreviewHash: String(input.previewHash || '').trim(),
        animated: Boolean(input.animated),
        updatedAt: new Date().toISOString(),
      };
      setDeletedLocalProjectModelPath(nextPath, false);
      updateLocalProjectModelMetadata(({ modelPreviews, modelProjects }) => {
        if (input.previewHash) modelPreviews[newName] = input.previewHash;
        if (input.projectFileHash) modelProjects[newName] = input.projectFileHash;
      });
    } else if (input.action === 'rename' || input.action === 'update') {
      const newName = String(input.newName || '').trim().slice(0, 100);
      if (!newName) throw new Error('new model name is required');
      const nextPath = getMeshPath(newName);
      if (nextPath !== path && extra.meshAssets[nextPath]) {
        throw new Error('model name already exists');
      }
      delete extra.meshAssets[path];
      extra.meshAssets[nextPath] =
        input.action === 'update'
          ? {
              ...asset!,
              hash: String(input.modelFileHash || '').trim(),
              modelPreviewHash:
                String(input.previewHash || '').trim() ||
                asset!.modelPreviewHash,
              updatedAt: new Date().toISOString(),
            }
          : asset!;
      if (!isContentHash(extra.meshAssets[nextPath].hash)) {
        throw new Error('model hash is invalid');
      }
      updateLocalProjectModelMetadata(({ modelPreviews, modelProjects }) => {
        const previousPreview = modelPreviews[storedName];
        const previousProject = modelProjects[storedName];
        if (newName !== storedName) {
          delete modelPreviews[storedName];
          delete modelProjects[storedName];
        }
        const previewHash =
          input.action === 'update'
            ? String(input.previewHash || '').trim() || previousPreview
            : previousPreview;
        const projectFileHash =
          input.action === 'update'
            ? String(input.projectFileHash || '').trim() || previousProject
            : previousProject;
        if (previewHash) modelPreviews[newName] = previewHash;
        if (projectFileHash) modelProjects[newName] = projectFileHash;
      });
    } else if (input.action === 'delete') {
      const cached = this._state.bakeCache.meshIdSetCache[asset!.modelId];
      moveProjectModelToTrash(
        extra,
        deleteAssets,
        path,
        cached?.bounds || [0, 0, 0],
      );
      setDeletedLocalProjectModelPath(path, true);
      // Keep the preview and editable VOXA project hashes while the model is
      // recoverable. They are removed only when the trash item is purged.
      updateTrash = true;
    } else if (input.action === 'restore') {
      const trashPath = requestedPath || getMeshPath(name);
      restoreProjectModelFromTrash(extra, deleteAssets, trashPath);
      setDeletedLocalProjectModelPath(trashPath, false);
      updateTrash = true;
    } else if (input.action === 'purge') {
      const trashPath = requestedPath || getMeshPath(name);
      purgeProjectModelFromTrash(deleteAssets, trashPath);
      const trashName = trashPath.replace(/^mesh\//, '').replace(/\.vb$/, '');
      updateLocalProjectModelMetadata(({ modelPreviews, modelProjects }) => {
        delete modelPreviews[trashName];
        delete modelProjects[trashName];
      });
      updateTrash = true;
    }
    const stream = new MuWriteStream(1);
    const diff = ExtraProjectInfoSchema.diff(this._state.replica.extraProjectInfo, extra, stream);
    if (diff) {
      this._state.replica.hotProjectDirty = true;
      const bytes = stream.bytes();
      this._protocol.broadcastRaw(bytes);
      this._state.replica.extraProjectInfo = ExtraProjectInfoSchema.patch(
        this._state.replica.extraProjectInfo,
        new MuReadStream(bytes),
      );
      const persistedStream = new MuWriteStream(1);
      ExtraProjectInfoSchema.diff(ExtraProjectInfoSchema.identity, this._state.replica.extraProjectInfo, persistedStream);
      const extraProjectHash = await this._state.contentServer.store(persistedStream.bytes());
      persistedStream.destroy();
      persistLocalProjectState(this._state.replica.permissionHash, extraProjectHash);
      await this._updateProjectByExtra();
    }
    stream.destroy();
    if (updateTrash) {
      const store = this._state.replica.projectStore;
      await this._applyProjectTransaction([
        ProjectRDA.action(store).deleteAssets.reset(deleteAssets),
      ]);
    }
    return {
      modelName:
        input.action === 'create' || input.action === 'rename' || input.action === 'update'
          ? String(input.newName).trim()
          : '',
    };
  };

  public updateLocalSharedScript = async (input: LocalSharedScriptAction) =>
    withLocalGroupSharedResourceLock(() => this._updateLocalSharedScript(input));

  private _updateLocalSharedScript = async (input: LocalSharedScriptAction) => {
    if (getConfigSync()?.method !== 'local') {
      throw new Error('local shared scripts are only available in local mode');
    }
    // Always begin with the map group's latest snapshot. A submap can have an
    // older in-memory copy while another map renamed, removed or saved a
    // shared script.
    await this._checkAndSetExtraProject();
    const fileId = String(input.fileId || '').trim();
    const file = this._state.codeEditor.fileDict[fileId];
    if (!file) throw new Error('script not found');
    if (file.name === 'index.js' || file.name === 'clientIndex.js') {
      throw new Error('entry scripts cannot be shared');
    }

    const replicaState = this._state.replica;
    const extra = ExtraProjectInfoSchema.clone(replicaState.extraProjectInfo);
    const previousExtra = ExtraProjectInfoSchema.clone(replicaState.extraProjectInfo);
    const config = getConfigSync();
    const callerOwnerId = localSharedScriptLockOwnerId(config?.containerName || '');
    let hash = '';
    if (input.action === 'share') {
      hash = String(input.hash || '').trim();
      if (!hash) throw new Error('script hash is required');
      const duplicate = Object.values(extra.scriptAssets).find(
        (script) => script.name === file.name && script.id !== fileId,
      );
      if (duplicate) throw new Error('script name already exists');
      extra.scriptAssets[fileId] = {
        hash,
        name: file.name,
        isClient: file.isClient,
        isShare: true,
        order: file.order,
        lockedMapTitle: '',
        lockedMapId: 0,
        id: fileId,
      };
    } else if (input.action === 'save') {
      hash = String(input.hash || '').trim();
      if (!hash) throw new Error('script hash is required');
      const shared = extra.scriptAssets[fileId];
      if (!canPersistLocalSharedScript('save', Boolean(shared?.isShare))) {
        throw new Error('script is no longer shared');
      }
      const next = applyLocalSharedScriptMutation(shared, {
        action: 'save', hash, name: file.name, isClient: file.isClient, order: file.order,
      }, callerOwnerId);
      Object.assign(shared, next);
    } else if (input.action === 'rename') {
      const name = String(input.name || '').trim();
      if (!name) throw new Error('script name is required');
      const duplicate = Object.values(extra.scriptAssets).find(
        (script) => script.name === name && script.id !== fileId,
      );
      if (duplicate) throw new Error('script name already exists');
      const shared = extra.scriptAssets[fileId];
      const next = applyLocalSharedScriptMutation(
        shared,
        { action: 'rename', name },
        callerOwnerId,
      );
      Object.assign(shared, next);
    } else if (input.action === 'lock' || input.action === 'unlock') {
      const shared = extra.scriptAssets[fileId];
      const next = applyLocalSharedScriptMutation(
        shared,
        input.action === 'lock'
          ? { action: 'lock', ownerId: input.ownerId, ownerTitle: input.ownerTitle }
          : { action: 'unlock', ownerId: input.ownerId },
        input.ownerId,
      );
      Object.assign(shared, next);
    } else {
      const shared = extra.scriptAssets[fileId];
      if (!shared?.isShare) throw new Error('script is not shared');
      hash = shared.hash;
      const next = applyLocalSharedScriptMutation(
        shared,
        { action: 'delete' },
        callerOwnerId,
      );
      if (next === undefined) delete extra.scriptAssets[fileId];
    }

    const stream = new MuWriteStream(1);
    const diff = ExtraProjectInfoSchema.diff(replicaState.extraProjectInfo, extra, stream);
    if (diff) {
      const bytes = stream.bytes();
      this._protocol.broadcastRaw(bytes);
      replicaState.extraProjectInfo = ExtraProjectInfoSchema.patch(
        replicaState.extraProjectInfo,
        new MuReadStream(bytes),
      );
      if (input.action !== 'unshare') {
        await this._codeEditorController.resyncFiles(
          replicaState.extraProjectInfo.scriptAssets,
          previousExtra.scriptAssets,
        );
      }
      const persistedStream = new MuWriteStream(1);
      ExtraProjectInfoSchema.diff(
        ExtraProjectInfoSchema.identity,
        replicaState.extraProjectInfo,
        persistedStream,
      );
      const extraProjectHash = await this._state.contentServer.store(
        persistedStream.bytes(),
      );
      persistedStream.destroy();
      persistLocalProjectState(replicaState.permissionHash, extraProjectHash);
      this._observedLocalExtraProjectHash = extraProjectHash;
      replicaState.hotProjectDirty = true;
    }
    stream.destroy();
    ExtraProjectInfoSchema.free(previousExtra);
    if (input.action === 'unshare') {
      this._codeEditorController.fileDictReplica.dispatch(
        this._codeEditorController.fileDictReplica
          .action()
          .update(fileId)
          // Saving a shared script must not turn it back into a local script in
          // the editor replica. The shared snapshot above remains authoritative
          // for `save`; only an explicit unshare action removes that status.
          .isShare(isSharedAfterLocalScriptAction(input.action)),
      );
    }
    return {
      hash,
      lockedMapId: replicaState.extraProjectInfo.scriptAssets[fileId]?.lockedMapId || 0,
    };
  };

  /**
   * 根据最新的extraProjectInfo中的mesh信息，更新project中的entity信息
   * 并广播给client重置project的信息
   * @returns
   */
  private async _updateProjectByExtra(repairStaleLocalPathsOnly = false) {
    this._logger.info(
      'update cold project and send actions by extra project info',
    );
    const replicaState = this._state.replica;
    const pending: Promise<string>[] = [];
    const { meshAssets } = replicaState.extraProjectInfo;
    const { meshIdSetCache } = this._state.bakeCache;
    const meshInfoByPath: Record<
      string,
      (typeof meshIdSetCache)[number]
    > = {};
    if (!repairStaleLocalPathsOnly) {
      runtimeMeshAssets(meshAssets).forEach(([path, asset]) => {
        const cache = meshIdSetCache[asset.modelId];
        // 如果hash和path都相等，这条缓存不需要拉取新的值修改
        if (cache && cache.hash === asset.hash && cache.path === path) {
          return;
        }
        pending.push(
          (async () => {
            const meshInfo = await this._state.bakeCache.getMeshInfo(
              asset.hash,
              AssetType.VOXEL_MODEL,
            );
            const runtimeMeshInfo = {
              hash: asset.hash,
              path,
              bounds: [
                meshInfo.bounds[0],
                meshInfo.bounds[1],
                meshInfo.bounds[2],
              ] as [number, number, number],
              motionIds: meshInfo.motionList?.map((motion) => motion.id) || [],
            };
            // Keep the Boxes id cache for legacy rename/migration fallback,
            // but also retain every path. Local/project libraries can contain
            // different models with the same numeric id.
            meshIdSetCache[asset.modelId] = runtimeMeshInfo;
            meshInfoByPath[path] = runtimeMeshInfo;
            return path;
          })(),
        );
      });
    }

    if (pending.length) {
      this._logger.info(`update project: hash ${pending.length} new mesh infos`);
    }
    const updateMeshPaths = new Set(await Promise.all(pending));
    const store = replicaState.projectStore;
    const actions: ProjectAction[] = [];

    // A model rename keeps modelId but changes the path derived from its name.
    // Repair every entity that still points to the old path, regardless of
    // whether the source is a local VOXA model or a project model.
    Object.values(replicaState.project.entitiesTree).forEach((entityNode) => {
      const entity = entityNode.value;
      if (!entity) return;
      if (
        resolveRenamedProjectMesh(
          entity.mesh,
          entity.meshId,
          meshAssets,
          meshIdSetCache,
        )
      ) {
        updateMeshPaths.add(entity.mesh);
      }
    });

    if (!updateMeshPaths.size) {
      return;
    }

    Object.keys(replicaState.project.entitiesTree).forEach((id) => {
      const entityNode = replicaState.project.entitiesTree[id];

      if (!entityNode.value) {
        return;
      }
      const entity = entityNode.value;
      const hasCurrentPath = Boolean(meshAssets[entity.mesh]);
      const renamedMesh = resolveRenamedProjectMesh(
        entity.mesh,
        entity.meshId,
        meshAssets,
        meshIdSetCache,
      );
      if (!updateMeshPaths.has(entity.mesh) && !renamedMesh) {
        return;
      }
      const meshInfo = hasCurrentPath
        ? meshInfoByPath[entity.mesh]
        : renamedMesh;
      if (!meshInfo) {
        return;
      }
      actions.push(
        ProjectRDA.action(store).entitiesTree.update(id).mesh(meshInfo.path),
      );
      actions.push(
        ProjectRDA.action(store)
          .entitiesTree.update(id)
          .bounds(meshInfo.bounds),
      );
      // 默认动作重置规则：
      // 非静态动作 且 在动作列表中不存在此动作时，重置为动作列表的首个动作
      if (
        entityNode.value.defaultMotionId &&
        !meshInfo.motionIds.includes(entityNode.value.defaultMotionId)
      ) {
        actions.push(
          ProjectRDA.action(store)
            .entitiesTree.update(id)
            .defaultMotionId(meshInfo.motionIds[0] || ''),
        );
      }
    });

    this._logger.info(
      `update project: need to broadcast ${actions.length} actions`,
    );

    if (actions.length > 0) {
      // broadcast update to clients
      this._protocol.broadcast.project(actions);
      this._setProjectDirty();
    }

    // apply to local store and clean up
    for (let i = 0; i < actions.length; ++i) {
      store.apply(ProjectRDA, actions[i]);
      ProjectActionSchema.free(actions[i]);
    }

    // update project
    store.state(ProjectRDA, replicaState.project);

    // clear dirty flag for project reference
    replicaState.projectDirty = false;
  }

  /**
   * 通过websocket将客户端的actions转发到其他容器
   * @param _actions
   * @private
   */
  private _broadcastActionsToSocket(_actions: ProjectAction[]) {
    this._logger.info(
      `broadcast actions to other server, actions length is ${_actions.length} `,
    );
    this._state.game.webSocket.send<BroadcastMsg>(
      generateBroadcastMsg({
        payload: _actions,
        type: BroadcastDataType.ACTION,
      }),
    );
  }

  public async startProject(): Promise<void> {
    if (this._state.game.state.replica.running) {
      this._logger.info('project already running');
      return;
    }

    this._logger.info(`wait to lock project state to start project...`);
    const lockProject = this._projectSemaphore.p();
    this._logger.info(`wait to lock permission state to start project...`);
    const lockPermissions = this._permissionSemaphore.p();
    try {
      // lock project and permission structures
      await lockProject;
      this._logger.info(`project state locked to start project...`);
      await lockPermissions;
      this._logger.info(`permission state locked to start project...`);

      // need to check running state in case it changed after acquiring locks
      const replicaState = this._state.replica;
      if (this._state.game.state.replica.running) {
        this._logger.info('project already running');
        return;
      }

      // enter busy state
      this._setBusyState(true);

      // save project state
      await this._storeProject();

      // update extra project
      await this._checkAndSetExtraProject();

      // synchronize engine state
      if (replicaState.hotProjectDirty) {
        await this._state.bakeCache.bake(
          replicaState.project,
          replicaState.extraProjectInfo,
          this._state.replica.hotProject,
        );
        replicaState.hotProjectDirty = false;
      }
      await this._state.game.synchronizeProject(replicaState.hotProject, {
        skipVoxels: true,
        play: true,
      });

      // update permission structure
      if (replicaState.projectHashDirty) {
        const res = await storeProject(
          this._state.buildSystem,
          replicaState.project,
        );
        await this._updateProjectAndGroupProject(res);
      }
    } finally {
      this._setBusyState(false);
      this._permissionSemaphore.v();
      this._logger.info(`permission state unlocked since project start ended`);
      this._projectSemaphore.v();
      this._logger.info(`project state unlocked since project start ended`);
    }

    return;
  }

  public async stopProject(): Promise<void> {
    if (!this._state.game.state.replica.running) {
      this._logger.info('project already stopped');
      return;
    }

    try {
      this._logger.info(`wait to lock project state to stop project...`);
      await this._projectSemaphore.p();
      this._logger.info(`project state locked to stop project...`);
      const replicaState = this._state.replica;

      //  have to check precondition a second time after locking
      if (!this._state.game.state.replica.running) {
        return;
      }

      this._setBusyState(true);
      await this._state.game.synchronizeProject(replicaState.hotProject, {
        skipVoxels: false,
        play: false,
      });
    } catch (e) {
      this._logger.error(`error stopping project ${e}`);
    } finally {
      this._setBusyState(false);
      this._projectSemaphore.v();
      this._logger.info(`project state unlocked since project stop ended`);
    }
  }

  public async saveProject(committerId: number = 0): Promise<string> {
    this._logger.info(`save project`);
    const replicaState = this._state.replica;

    replicaState.lastAutoSave = this._state.game.state.clock.clock;

    this._logger.info('wait to lock project state to save project...');
    const lockProject = this._projectSemaphore.p();
    this._logger.info('wait to lock permission state to save project...');
    const lockPermissions = this._permissionSemaphore.p();
    try {
      await lockProject;
      this._logger.info('project state locked to save project...');
      await lockPermissions;
      this._logger.info('permission state locked to save project...');

      this._setBusyState(true);

      await this._storeProject();

      if (replicaState.projectHashDirty) {
        this._logger.info('project hash dirty');
        replicaState.project.committerId = committerId;
        const res = await storeProject(
          this._state.buildSystem,
          replicaState.project,
        );
        await this._updateProjectAndGroupProject(res);
      }
      if (replicaState.permissionsDirty) {
        this._logger.info('permission hash dirty');
        await this._syncPermissions();
      } else {
        this._logger.info('retry container save');
        await this._savePermissions();
      }
    } catch (e) {
      this._logger.error(
        `error saving project ${JSON.stringify(e.stack || e)}`,
      );
      throw e;
    } finally {
      this._setBusyState(false);
      this._permissionSemaphore.v();
      this._logger.info('permission state unlocked since project save ended');
      this._projectSemaphore.v();
      this._logger.info('project state unlocked since project save ended');
    }

    if (typeof process !== 'undefined' && process.memoryUsage) {
      this._logger.info(`save ${JSON.stringify(process.memoryUsage())}`);
    }

    const permissionHash = this._state.replica.permissionHash;
    persistLocalProjectState(permissionHash);
    syncLocalProjectModelPaths(
      Object.values(this._state.replica.project.entitiesTree).flatMap((node) => {
        const mesh = node.value?.mesh;
        return typeof mesh === 'string' && mesh ? [mesh] : [];
      }),
    );
    return permissionHash;
  }

  public async createBranch(
    branch: string,
    headHash?: string,
  ): Promise<string> {
    this._logger.info(`creating branch ${branch}`);
    await this.saveProject();
    await this.permissionTransaction()
      .push((action) =>
        action.versionControl.branches.set(branch, {
          name: branch,
          headHash: headHash ? headHash : this._state.replica.projectHash,
        }),
      )
      .commit();
    return this._state.replica.permissionHash;
  }

  public async switchBranch(branch: string): Promise<string> {
    this._logger.info(`switching branch ${branch}`);
    await this.saveProject();
    await this.permissionTransaction()
      .push((action) => action.versionControl.currentBranch(branch))
      .commit();
    return this._state.replica.permissionHash;
  }

  public async renameBranch(
    oldBranch: string,
    branch: string,
  ): Promise<string> {
    this._logger.info(`renaming branch ${branch}`);
    await this.saveProject();
    await this.permissionTransaction()
      .push((action) =>
        action.versionControl.branches.set(oldBranch, {
          ...this._state.replica.permissions.versionControl.branches[oldBranch],
          name: branch,
        }),
      )
      .commit();
    return this._state.replica.permissionHash;
  }

  public async redeemToken(userId: string, tokenString: string) {
    const token = parsePermissionToken(
      this._state.game.state.settings.permissionTokenSecret,
      tokenString,
    );

    if (!token) {
      this._logger.info(
        `reject attempt to redeem invalid permission token from ${userId}`,
      );
      return;
    }
    const group = token.group;
    PermissionTokenSchema.free(token);

    const replicaState = this._state.replica;
    if (!(group in replicaState.permissions.groups)) {
      this._logger.info(
        `invalid group in permission token ${tokenString} from ${userId}`,
      );
      return;
    }
    if (userId in replicaState.permissions.groups[group].members) {
      this._logger.info(`user ${userId} already in group ${group}`);
      return;
    }
    if (userId === replicaState.permissions.owner) {
      this._logger.info(`owner: ${userId} attemp to join groups: ${group}`);
      return;
    }

    this._logger.info(`redeeming token for ${userId} for group ${group}`);
    await this.permissionTransaction()
      .push((action) =>
        action.groups.update(group).members.set(userId, {
          addedAt: new Date(),
        }),
      )
      .commit();
  }
}

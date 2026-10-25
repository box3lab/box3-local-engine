import { MuChildProcessSocket } from '@box/mudb/socket/child_process/client';
import {
  MuSocketServerSpec,
  MuSocketServerState,
} from '@box/mudb/socket/socket';
import type { ParsedError } from '@box/schema/debugger-console/schema';
import { EventBus } from '@box/utils/event';
import { ChildProcess, fork } from 'child_process';
import { extname, join } from 'path';
import { Logger } from 'pino';
import type { ScriptServer } from '../type';
import { IvmpScriptSocketClient } from './ivmp-script-socket-client';

/**
 * Source-mode workers execute TypeScript and therefore need SWC. Production
 * workers are built JavaScript and the production image deliberately excludes
 * that development-only compiler.
 */
function scriptWorkerExecArgv(entryPath: string) {
  const runtimeArgs = ['--no-node-snapshot'];
  return extname(entryPath) === '.ts'
    ? ['-r', '@swc-node/register', ...runtimeArgs]
    : runtimeArgs;
}

export class IvmpScriptSocketServer implements ScriptServer {
  private _state = MuSocketServerState.INIT;
  public state() {
    return this._state;
  }
  /**
   * 记录当前 start 时注册的回调
   */
  private _spec: MuSocketServerSpec | undefined;

  public clients: IvmpScriptSocketClient[] = [];
  private _sessionIdCounter = 0;
  private _childProcess: ChildProcess;
  public onIsolateException = new EventBus<ParsedError>();

  constructor(
    private logger: Logger,
    private hostUuid: string,
    private childProcessLogLevel?: string,
    private scriptTimeout?: number,
    private scriptMemoryLimit?: number,
  ) /**
   * 仅用于 Logger 记录对应 Host UUID
   */ {
    this._childProcess = this.createChildProcess();
  }

  private createChildProcess() {
    const childProcess = fork(
      join(__dirname, './ivmp-process-entry.ts'),
      undefined,
      {
        execArgv: scriptWorkerExecArgv(join(__dirname, './ivmp-process-entry.ts')),
        stdio: 'inherit',
        serialization: 'advanced',
        env: Object.assign({}, process.env, {
          HOST_UUID: this.hostUuid,
          LOG_LEVEL: this.childProcessLogLevel,
          SCRIPT_TIMEOUT: this.scriptTimeout,
          SCRIPT_MEMORY_LIMIT: this.scriptMemoryLimit,
        }),
      } as any, // Node 类型的依赖版本待更新
    );

    childProcess.on('close', (code, signal) => {
      this.logger.error(
        `child process ${this._childProcess.pid} closed with code ${code} and signal ${signal}`,
      );
    });

    childProcess.on('error', (error) => {
      this.logger.error(`child process ${this._childProcess.pid} error`);
      this.logger.error(error);
    });

    childProcess.once('spawn', () => {
      this.logger.info(`child process ${this._childProcess.pid} spawned`);
    });

    return childProcess;
  }

  /**
   * 由 MuServer 调用，用于注册回调，仅允许调用一次
   */
  public start(spec: MuSocketServerSpec) {
    if (this._state !== MuSocketServerState.INIT) {
      this.logger.warn('Cannot start when socket server is already started.');
      return;
    }

    this._state = MuSocketServerState.RUNNING;

    this._spec = spec;

    this._spec.ready();
    this.logger.debug('Socket server started.');
  }

  /**
   * 由 ScriptHost 调用，启动脚本
   * 对应的停止则是直接 disconnect
   */
  public async launch() {
    const sessionId = `script-${this._sessionIdCounter++}`;
    if (this._childProcess.connected === false) {
      this.logger.warn(
        `child process ${this._childProcess.pid} is not connected when launching script server`,
      );
      if (!this._childProcess.killed) {
        this._childProcess.kill();
      }
      this._childProcess = this.createChildProcess();
    }

    const socketClient = new IvmpScriptSocketClient(
      sessionId,
      new MuChildProcessSocket(
        this._childProcess.pid?.toString() || '0',
        this._childProcess,
      ),
      this.onIsolateException,
      this.logger,
    );

    this.clients.push(socketClient);
    socketClient.events.close.sub(() => {
      this.clients.splice(this.clients.indexOf(socketClient), 1);
    });

    return new Promise<void>((resolve, reject) => {
      const onCloseBeforeReady = () => {
        this.logger.warn(`socket ${sessionId} closed before ready`);
        reject();
      };

      const onReady = () => {
        this.logger.info(`socket ${sessionId} ready`);
        socketClient.events.close.unsub(onCloseBeforeReady);
        resolve();
      };

      // 确保只有 Ready 后 Launch 才成功
      socketClient.events.close.sub(onCloseBeforeReady);
      socketClient.events.ready.next(onReady);

      // 虽然看起来是同步的，但实际上 socket 的 connect 回调触发由于依赖了 ChildProcess 中的逻辑，因此是异步的，只是没有处理而已
      this._spec?.connection(socketClient);
    });
  }

  /**
   * 一旦 Close(状态为Shutdown)就不能再启动
   */
  public close() {
    this._state = MuSocketServerState.SHUTDOWN;
    this.clients.forEach((c) => c.close());

    // The script worker is not detached; leaving it alive leaks its process
    // after a map runtime or development stack is restarted.
    if (!this._childProcess.killed) {
      this._childProcess.kill('SIGTERM');
    }

    this._spec?.close();
    this.logger.debug('Socket server closed.');
  }
}

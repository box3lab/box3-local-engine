import * as crypto from 'node:crypto';
import { shell } from 'electron';

import { readResourceCache, clearResourceCache } from './resource-cache';
import { canUseMapResourceCache } from '../../shared/server-address';
import { inspectMapCaches } from './map-cache';

import type { Session } from 'electron';
import type { PackageDescriptor, PlayerServerRecord } from '../types';
import type { ServerCacheUsage } from '../../shared/cache-types';

export type GameSession = Session;

export interface GameWindow {
    webContents:{
        setWindowOpenHandler(handler:() => { action:'deny' }):void;
        on(
            event:'will-navigate',
            listener:(event:{ preventDefault():void }, target:string) => void,
        ):void;
    };
    setMenuBarVisibility(visible:boolean):void;
    on(event:'closed', listener:() => void):void;
    loadURL(url:string):Promise<void>;
    setTitle(title:string):void;
    isDestroyed():boolean;
    destroy():void;
    focus?():void;
    isMinimized?():boolean;
    restore?():void;
}

export interface GameWindowOptions {
    width:number;
    height:number;
    minWidth:number;
    minHeight:number;
    title:string;
    autoHideMenuBar:boolean;
    backgroundColor:string;
    webPreferences:{
        session:GameSession;
        contextIsolation:boolean;
        nodeIntegration:boolean;
        sandbox:boolean;
        webSecurity:boolean;
        allowRunningInsecureContent:boolean;
    };
}

export interface GameWindowManagerOptions {
    createBrowserWindow:(options:GameWindowOptions) => GameWindow;
    sessions:{ fromPartition(partition:string, options:{ cache:boolean }):GameSession };
    syncCookies:(endpoint:string, targetSession:GameSession) => Promise<void>;
    onStateChange?:(game:{ serverId:string; mapId:string } | null) => void;
}

export interface GameWindowManager {
    launch(options:{
        server:PlayerServerRecord;
        descriptor:PackageDescriptor;
        launchTicket:string;
        title:string;
    }):Promise<{ window:GameWindow }>;
    close():Promise<void>;
    clearServerCache(serverId:string):Promise<void>;
    isActiveFor(serverId:string):boolean;
    playerSessions():GameSession[];
    currentGame():{ serverId:string; mapId:string } | null;
    focusCurrent(serverId:string, mapId:string):boolean;
    cacheStatus(serverId:string, endpoint:string):Promise<ServerCacheUsage>;
    clearResources(serverId:string):Promise<void>;
    clearMapResources(serverId:string, endpoint:string, mapId?:string):Promise<void>;
    clearBrowserResources(serverId:string):Promise<void>;
}

export function makeGameUrl(
    server:PlayerServerRecord,
    descriptor:PackageDescriptor,
    launchTicket:string,
):URL {
    const url = new URL(server.endpoint);
    const basePath = url.pathname.replace(/\/$/, '');
    url.pathname = `${basePath}/p/${descriptor.accessId}`;
    url.search = '';
    if (canUseMapResourceCache(server.endpoint)) {
        url.searchParams.set('box3ServiceWorkerCache', '1');
        url.searchParams.set('box3PermanentMapId', descriptor.permanentMapId);
        url.searchParams.set('box3ReleaseVersion', descriptor.releaseVersion);
        url.searchParams.set('box3ManifestDigest', descriptor.manifestDigest);
        url.hash = new URLSearchParams({ box3LaunchTicket: launchTicket }).toString();
    } else {
        // Non-loopback HTTP can play online but cannot register a Service Worker.
        url.searchParams.set('box3DisableResourceCache', '1');
        url.hash = '';
    }
    return url;
}

export function isAllowedGamePermission(
    permission:string,
    requestingUrl:string,
    isMainFrame:boolean,
    allowedOrigin:string,
):boolean {
    if (!isMainFrame || !['pointerLock', 'fullscreen'].includes(permission)) {
        return false;
    }
    try {
        return new URL(requestingUrl).origin === allowedOrigin;
    } catch {
        return false;
    }
}

function cachePartition(serverId:string):string {
    const id = crypto.createHash('sha256').update(serverId).digest('hex').slice(0, 32);
    return `persist:box-player-${id}`;
}

export function createGameWindowManager({
    createBrowserWindow,
    sessions,
    syncCookies,
    onStateChange,
}:GameWindowManagerOptions):GameWindowManager {
    let window:GameWindow | undefined;
    let gameSession:GameSession | undefined;
    let activeServerId:string | undefined;
    let activeMapId:string | undefined;
    const playerSessions = new Set<GameSession>();

    async function close():Promise<void> {
        const currentWindow = window;
        const currentSession = gameSession;
        window = undefined;
        gameSession = undefined;
        activeServerId = undefined;
        activeMapId = undefined;
        if (currentWindow) {
            onStateChange?.(null);
        }
        if (currentSession) {
            playerSessions.delete(currentSession);
        }
        if (currentWindow && !currentWindow.isDestroyed()) {
            currentWindow.destroy();
        }
    }

    async function clearServerCache(serverId:string):Promise<void> {
        if (activeServerId === serverId) {
            await close();
        }
        const target = sessions.fromPartition(cachePartition(serverId), { cache: true });
        await target.clearStorageData({ storages: ['cookies', 'serviceworkers', 'cachestorage'] });
    }

    return Object.freeze({
        async launch({ server, descriptor, launchTicket, title }):Promise<{ window:GameWindow }> {
            if (
                window &&
                !window.isDestroyed() &&
                activeServerId === server.id &&
                activeMapId === descriptor.accessId
            ) {
                if (window.isMinimized?.()) {
                    window.restore?.();
                }
                window.focus?.();
                return { window };
            }
            await close();
            const origin = new URL(server.endpoint).origin;
            const url = makeGameUrl(server, descriptor, launchTicket);

            try {
                // Keep one persistent origin partition per server so Service Worker
                // Cache Storage survives relaunches and is shared across its maps.
                const nextSession = sessions.fromPartition(cachePartition(server.id), {
                    cache: true,
                });
                gameSession = nextSession;
                playerSessions.add(nextSession);
                nextSession.setPermissionCheckHandler(
                    (_webContents, permission, requestingOrigin, details) =>
                        isAllowedGamePermission(
                            permission,
                            requestingOrigin,
                            details.isMainFrame,
                            origin,
                        ),
                );
                nextSession.setPermissionRequestHandler(
                    (_webContents, permission, callback, details) => {
                        const allowed =
                            'requestingUrl' in details &&
                            'isMainFrame' in details &&
                            isAllowedGamePermission(
                                permission,
                                details.requestingUrl,
                                details.isMainFrame,
                                origin,
                            );
                        callback(allowed);
                    },
                );
                await syncCookies(server.endpoint, nextSession);

                const nextWindow = createBrowserWindow({
                    width: 1280,
                    height: 800,
                    minWidth: 900,
                    minHeight: 620,
                    title,
                    autoHideMenuBar: true,
                    backgroundColor: '#000000',
                    webPreferences: {
                        session: nextSession,
                        contextIsolation: true,
                        nodeIntegration: false,
                        sandbox: true,
                        webSecurity: true,
                        allowRunningInsecureContent: false,
                    },
                });
                window = nextWindow;
                activeServerId = server.id;
                activeMapId = descriptor.accessId;
                nextWindow.setMenuBarVisibility(false);
                nextWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
                nextWindow.webContents.on('will-navigate', (event, target) => {
                    let next:URL|null;
                    try {
                        next = new URL(target);
                    } catch {
                        event.preventDefault();
                        return;
                    }

                    const serverEndpoint = new URL(server.endpoint);
                    if (next.origin !== origin) {
                        // Open in browser for safety
                        shell.openExternal(next.href)
                        event.preventDefault();
                    }
                    if(next.pathname.replace(/\/+$/, '') === serverEndpoint.pathname.replace(/\/+$/, '')){
                        // Close window if game exit
                        close()
                    }
                });
                nextWindow.on('closed', () => {
                    if (window === nextWindow) {
                        void close();
                    }
                });
                await nextWindow.loadURL(url.toString());
                nextWindow.setTitle(title);
                onStateChange?.({ serverId: server.id, mapId: descriptor.accessId });
                return { window: nextWindow };
            } catch (error) {
                await close();
                throw new Error(`无法打开游玩地图：${error.message}`);
            }
        },
        close,
        clearServerCache,
        isActiveFor(serverId:string):boolean {
            return activeServerId === serverId;
        },
        playerSessions():GameSession[] {
            return [...playerSessions];
        },
        currentGame() {
            return window && !window.isDestroyed() && activeServerId && activeMapId
                ? { serverId: activeServerId, mapId: activeMapId }
                : null;
        },
        focusCurrent(serverId, mapId) {
            if (
                !window ||
                window.isDestroyed() ||
                activeServerId !== serverId ||
                activeMapId !== mapId
            ) {
                return false;
            }
            if (window.isMinimized?.()) {
                window.restore?.();
            }
            window.focus?.();
            return true;
        },
        async cacheStatus(serverId, endpoint) {
            const target = sessions.fromPartition(cachePartition(serverId), { cache: true });
            const usage = await readResourceCache(target);
            return {
                serverId,
                ...usage,
                inUse: activeServerId === serverId,
                maps: usage.staticBytes ? await inspectMapCaches(target, endpoint) : [],
            };
        },
        async clearResources(serverId) {
            if (activeServerId === serverId) {
                throw new Error('请先关闭此服务器的游戏窗口，再清理地图缓存。');
            }
            const target = sessions.fromPartition(cachePartition(serverId), { cache: true });
            await clearResourceCache(target);
        },
        async clearMapResources(serverId, endpoint, mapId) {
            if (activeServerId === serverId) {
                throw new Error('请先关闭此服务器的游戏窗口，再清理地图缓存。');
            }
            const target = sessions.fromPartition(cachePartition(serverId), { cache: true });
            await inspectMapCaches(target, endpoint, mapId, !mapId);
        },
        async clearBrowserResources(serverId) {
            if (activeServerId === serverId) {
                throw new Error('请先关闭游戏窗口，再清理浏览器缓存。');
            }
            const target = sessions.fromPartition(cachePartition(serverId), { cache: true });
            await target.clearCache();
        },
    });
}

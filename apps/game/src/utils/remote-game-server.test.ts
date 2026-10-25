import { resolveGameServerTarget } from './remote-game-server'

describe('resolveGameServerTarget', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window')
  })

  test('keeps session and socket remote while routing launcher map assets through same-origin SW URLs', () => {
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })
    const target = resolveGameServerTarget({
      mode: 'play',
      ARENA_URL: 'https://play.example.test',
      CDN_PATH: 'http://play.example.test/runtime/play/map-one',
      remoteGameServerURL: 'https://runtime.example.test',
      launcherServiceWorkerMode: true,
    })

    expect(target.sessionURL).toBe('https://runtime.example.test/api/session')
    expect(target.socketServerURL).toBe('wss://runtime.example.test')
    expect(target.assetBaseURL).toBe('http://play.example.test/runtime/play/map-one')
    expect(target.isRemote).toBe(true)
  })

  test('keeps ordinary browser assets on the remote server', () => {
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })
    const target = resolveGameServerTarget({
      mode: 'play',
      ARENA_URL: 'https://play.example.test',
      CDN_PATH: '/runtime/play/map-one',
      remoteGameServerURL: 'https://runtime.example.test',
      launcherServiceWorkerMode: false,
    })

    expect(target.assetBaseURL).toBe('https://runtime.example.test')
  })
})

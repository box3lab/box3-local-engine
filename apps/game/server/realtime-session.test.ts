import { beforeEach, expect, jest, test } from '@jest/globals';
jest.mock('./creator-scene-websocket', () => ({ ensureCreatorSceneWebSocketServer: jest.fn(async () => {}) }));
jest.mock('./play-worlds', () => ({ findPlayWorld: jest.fn(() => ({ publicId: 'map-a' })), getPlayWorlds: jest.fn(() => []) }));
jest.mock('./player-service-client', () => ({ requestPlayerServiceIp: () => '127.0.0.1', resolvePlayerServiceIdentity: jest.fn(async () => ({ identity: { subjectId: 'player-a' } })) }));
jest.mock('./play-admin-security', () => ({ allowPlayLibraryAdmin: jest.fn(() => false) }));
jest.mock('./play-system-status', () => ({ getPlaySystemStatus: jest.fn(async () => ({})) }));
jest.mock('./local-player-identity', () => ({ isInternalIdentityRequest: jest.fn(() => false), listPlayerRevocations: jest.fn(async () => ({ cursor: '0', events: [] })) }));
jest.mock('./player-change-feed', () => ({ ensurePlayerChangeFeed: jest.fn(async () => {}), playerChangeFeed: { subscribe: jest.fn(() => () => {}) } }));
jest.mock('./player-admin-authorization', () => ({ allowPlayerAdminRequestOrigin: jest.fn(() => true), sendPlayerAdminApiError: (res: any) => res.status(403).end() }));
jest.mock('./player-admin-identity', () => ({ resolvePlayerAdminSession: jest.fn(async () => ({ role: 'moderator', permissions: ['players.view'] })) }));
const handler = require('../pages/api/realtime/session').default;
const { consumeRealtimeTicket } = require('./realtime-tickets');
const { isInternalIdentityRequest, listPlayerRevocations } = require('./local-player-identity');
const { playerChangeFeed } = require('./player-change-feed');
const { resolvePlayerAdminSession } = require('./player-admin-identity');
type MockLike = {
  mock: {
    calls: unknown[][];
  };
  mockReturnValue: (value: unknown) => void;
  mockResolvedValue: (value: unknown) => void;
};
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function response() {
  const res: any = { code: 200, body: undefined, setHeader() {}, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; }, end() { return this; } };
  return res;
}
const request = (body: any, extra = {}) => ({ method: 'POST', headers: { host: 'engine.test', origin: 'http://engine.test' }, body, ...extra }) as any;
beforeEach(() => { jest.clearAllMocks(); process.env.BOX_DEPLOYMENT_MODE = 'player-service'; });
test('bootstrap rejects cross-origin, unsupported methods and unauthenticated internal clients', async () => {
  const cross = response(); await handler(request({ kind: 'admin-events' }, { headers: { host: 'engine.test', origin: 'http://evil.test' } }), cross); expect(cross.code).toBe(403);
  const method = response(); await handler(request({}, { method: 'GET' }), method); expect(method.code).toBe(405);
  const internal = response(); await handler(request({ kind: 'revocations', since: new Date().toISOString() }), internal); expect(internal.code).toBe(401);
});
test('admin grants require CSRF and filter topics without disclosing player data', async () => {
  const res = response(); await handler(request({ kind: 'admin-events' }), res); expect(res.code).toBe(200);
  expect(resolvePlayerAdminSession).toHaveBeenCalledWith(expect.anything(), { requireCsrf: true });
  const messages: any[] = [];
  const binding = consumeRealtimeTicket(res.body.ticket, 'engine.test')(value => messages.push(value));
  const callback = (playerChangeFeed.subscribe as MockLike).mock.calls[0][0] as (name: string) => void;
  callback('users'); callback('identity_bans'); callback('script_admin_keys'); callback('admin_accounts');
  expect(messages).toEqual([{ type: 'change', topic: 'players' }, { type: 'reauthenticate' }]); binding.close();
});
test('revocation replay recovers late lower ids and deduplicates delivery', async () => {
  (isInternalIdentityRequest as MockLike).mockReturnValue(true);
  const res = response(); await handler(request({ kind: 'revocations', after: '41', since: new Date(Date.now() - 300_000).toISOString() }), res);
  expect(res.code).toBe(200);
  const messages: any[] = [];
  const binding = consumeRealtimeTicket(res.body.ticket, 'internal')(value => messages.push(value));
  await flush();
  const callback = (playerChangeFeed.subscribe as MockLike).mock.calls[0][0] as (name: string) => void;
  (listPlayerRevocations as MockLike).mockResolvedValue({ cursor: '40', events: [{ id: '40', subjectId: 'player-a', reason: 'banned', createdAt: new Date().toISOString() }] } as never);
  callback('player_revocations'); await flush(); callback('player_revocations'); await flush();
  expect((listPlayerRevocations as MockLike).mock.calls.every(args => args[0] === 0)).toBe(true);
  expect(messages.filter(e => e.type === 'revocations')).toEqual([{ type: 'revocations', cursor: '41', events: [expect.objectContaining({ id: '40' })] }]);
  binding.close();
});

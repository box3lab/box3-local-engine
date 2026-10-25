declare const jest: typeof import('@jest/globals').jest;
import { afterEach, expect, test } from '@jest/globals';
import { EngineClient } from './client';

jest.mock('../config/client', () => ({clientConfig:{}}));
jest.mock('../engine/settings/settings-controller', () => ({setGameSettings:jest.fn()}));
jest.mock('../utils/error-handler', () => ({installErrorHandler:jest.fn()}));
jest.mock('../utils/logger', () => ({rootLogger:{child:jest.fn()}}));
jest.mock('../messenger', () => ({messenger:{}}));
jest.mock('./backend-rpc-client', () => ({BackendClientRPC:jest.fn()}));
jest.mock('../utils/performance-test', () => ({DISPOSED_WEAK_SET:new WeakSet()}));
jest.mock('../utils/token', () => ({getToken:jest.fn(),setToken:jest.fn()}));
jest.mock('./client-schema', () => ({getMuRef:jest.fn()}));

afterEach(() => {
  jest.useRealTimers();
});
test('engine disposal releases its game and stops recurring work exactly once', () => {
  jest.useFakeTimers();
  const poll = jest.fn();
  const destroy = jest.fn();
  const clearChange = jest.fn();
  const clearReady = jest.fn();
  const engine = Object.assign(Object.create(EngineClient.prototype), {
    _game: {destroy},
    onGameChange:{unsubAll:clearChange},
    onGameReady:{unsubAll:clearReady},
    memoryMeasurementTimer:setTimeout(poll, 10000),
  }) as EngineClient;
  engine.dispose();
  engine.dispose();
  jest.runAllTimers();
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(clearChange).toHaveBeenCalledTimes(1);
  expect(clearReady).toHaveBeenCalledTimes(1);
  expect(poll).not.toHaveBeenCalled();
});

import { expect, test } from '@jest/globals';
import {
  ContentResolver,
  isAbsoluteContentURL,
  resolveContentURL,
} from '@box/content-server/content-fetch';
import { resolveHashURL } from 'src/utils/hash-url';

test('keeps same-origin map resources on normal HTTP paths for Service Worker interception', () => {
  const prefix = 'http://127.0.0.1:3121/runtime/play/map/block/';
  const path = '/runtime/play/map/block/QmHash';
  expect(isAbsoluteContentURL(path)).toBe(true);
  expect(resolveContentURL(path, prefix)).toBe(path);
  expect(resolveHashURL('http://127.0.0.1:3121/runtime/play/map', 'QmHash'))
    .toBe('http://127.0.0.1:3121/runtime/play/map/block/QmHash');
});

test('preserves absolute URLs and prefixes only bare content hashes', () => {
  const prefix = 'http://127.0.0.1:3121/runtime/play/map/block/';
  const remote = 'https://assets.example.test/engine/m/hash.png';
  expect(isAbsoluteContentURL(remote)).toBe(true);
  expect(resolveContentURL(remote, prefix)).toBe(remote);
  expect(isAbsoluteContentURL('QmHash')).toBe(false);
  expect(resolveContentURL('QmHash', prefix)).toBe(`${prefix}QmHash`);
});

test('routes image requests through the same-origin runtime path', () => {
  const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window;
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
  try {
    const requestedUrls: string[] = [];
    const resolver = new ContentResolver({
      cacheIPFS: false,
      cdnPath: 'http://127.0.0.1:3121/runtime/play/map',
      ossCdnURL: 'http://127.0.0.1:3121/runtime/play/map',
    });
    resolver.fetchImage('/runtime/play/map/block/QmHash', ((request, url) => {
      requestedUrls.push(url);
      request.loaded = true;
      return Promise.resolve(request);
    }) as never);
    expect(requestedUrls).toEqual(['/runtime/play/map/block/QmHash']);
  } finally {
    if (originalWindow === undefined) Reflect.deleteProperty(globalThis, 'window');
    else Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
  }
});

test('does not rewrite API routes or foreign origins', () => {
  const prefix = 'http://127.0.0.1:3121/runtime/play/map/block/';
  expect(resolveContentURL('/api/session', prefix)).toBe('/api/session');
  expect(resolveContentURL('https://assets.example.test/runtime/play/map/block/QmHash', prefix))
    .toBe('https://assets.example.test/runtime/play/map/block/QmHash');
});

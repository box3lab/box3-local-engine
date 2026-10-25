import { afterEach, expect, test } from '@jest/globals';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { FileSystemContentServer } from '../../../packages/content-server/src/file-system-store-node';

function encodeBase58(bytes: Uint8Array): string {
  const alphabet =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = BigInt(`0x${Buffer.from(bytes).toString('hex')}`);
  let encoded = '';
  while (value > 0n) {
    encoded = alphabet[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  return encoded;
}

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test.each(['buffer', 'view'])(
  'persisted %s bytes match the hash even when the caller reuses its serialization buffer',
  async (kind) => {
    const root = await mkdtemp(path.join(tmpdir(), 'box-content-integrity-'));
    roots.push(root);
    const store = new FileSystemContentServer(root);
    const backing = Buffer.from('prefix-original-model-bytes-suffix');
    const input =
      kind === 'buffer' ? backing : new Uint8Array(backing.buffer, backing.byteOffset + 7, 20);
    const original = Buffer.from(input);
    const expected = encodeBase58(
      Buffer.concat([Buffer.from([0x12, 0x20]), createHash('sha256').update(original).digest()]),
    );
    const pending = store.store(input);
    backing.fill(0);
    const hash = await pending;
    expect(hash).toBe(expected);
    expect(Buffer.from((await store.retrieve(hash))!)).toEqual(original);
  },
);

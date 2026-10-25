import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

import bs58 from 'bs58';

import { ContentServer, Hash } from './index';

function contentHash(content: Uint8Array): Hash {
  const digest = createHash('sha256').update(content).digest();
  const multihash = Buffer.concat([
    Buffer.from([0x12, digest.byteLength]),
    digest,
  ]);
  return bs58.encode(multihash);
}

function normalizeHash(hash: Hash): Hash | undefined {
  const value = hash.split('.')[0];
  const isBase58ContentHash = /^[1-9A-HJ-NP-Za-km-z]+$/.test(value);
  const isOssContentHash = /^[A-Za-z0-9_-]{43}$/.test(value);
  if (!isBase58ContentHash && !isOssContentHash) {
    return undefined;
  }
  return value;
}

/**
 * A persistent local adapter for the ContentServer seam.
 *
 * Each content-addressed blob is stored as one file. This intentionally keeps
 * the format boring so a local project can be copied, archived, and inspected
 * without running any infrastructure.
 */
export class FileSystemContentServer implements ContentServer {
  constructor(private readonly directory: string) {}

  public async init() {
    await fs.mkdir(this.directory, { recursive: true });
  }

  public async store(content: Uint8Array): Promise<Hash> {
    // Callers may return serialization buffers to a pool before the async
    // filesystem write finishes. Hash and persist the same owned snapshot.
    const snapshot = Buffer.from(content);
    const hash = contentHash(snapshot);
    const target = path.join(this.directory, hash);

    await fs.mkdir(this.directory, { recursive: true });

    try {
      await fs.writeFile(target, snapshot, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }

    return hash;
  }

  public async retrieve(hash: Hash): Promise<Uint8Array | undefined> {
    const normalizedHash = normalizeHash(hash);
    if (!normalizedHash) {
      return undefined;
    }

    try {
      return await fs.readFile(path.join(this.directory, normalizedHash));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }
}

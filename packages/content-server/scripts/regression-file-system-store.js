'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { FileSystemContentServer } = require('../build/file-system-store-node');

async function main() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'box-content-store-'));
    const blobRoot = path.join(root, 'source', 'blobs');
    try {
        const contentServer = new FileSystemContentServer(blobRoot);
        await contentServer.init();
        await fs.rm(blobRoot, { recursive: true });

        const content = Buffer.from('saved after the blob directory was removed');
        const hash = await contentServer.store(content);

        assert.deepEqual(await contentServer.retrieve(hash), content);
        console.log('filesystem content store recovery regression passed');
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

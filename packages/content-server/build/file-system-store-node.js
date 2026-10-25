"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemContentServer = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const bs58_1 = __importDefault(require("bs58"));
function contentHash(content) {
    const digest = (0, crypto_1.createHash)('sha256').update(content).digest();
    const multihash = Buffer.concat([
        Buffer.from([0x12, digest.byteLength]),
        digest,
    ]);
    return bs58_1.default.encode(multihash);
}
function normalizeHash(hash) {
    const value = hash.split('.')[0];
    const isBase58ContentHash = /^[1-9A-HJ-NP-Za-km-z]+$/.test(value);
    const isOssContentHash = /^[A-Za-z0-9_-]{43}$/.test(value);
    if (!isBase58ContentHash && !isOssContentHash) {
        return undefined;
    }
    return value;
}
class FileSystemContentServer {
    constructor(directory) {
        this.directory = directory;
    }
    async init() {
        await fs_1.promises.mkdir(this.directory, { recursive: true });
    }
    async store(content) {
        const snapshot = Buffer.from(content);
        const hash = contentHash(snapshot);
        const target = path_1.default.join(this.directory, hash);
        await fs_1.promises.mkdir(this.directory, { recursive: true });
        try {
            await fs_1.promises.writeFile(target, snapshot, { flag: 'wx' });
        }
        catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
        return hash;
    }
    async retrieve(hash) {
        const normalizedHash = normalizeHash(hash);
        if (!normalizedHash) {
            return undefined;
        }
        try {
            return await fs_1.promises.readFile(path_1.default.join(this.directory, normalizedHash));
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return undefined;
            }
            throw error;
        }
    }
}
exports.FileSystemContentServer = FileSystemContentServer;

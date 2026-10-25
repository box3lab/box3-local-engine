import * as crypto from 'node:crypto';

import type { PackageAsset, PackageDescriptor, TrustedSigningKey } from '../types';

export const MAX_ASSET_COUNT = 20_000;
export const MAX_ASSET_BYTES = 512 * 1024 * 1024;
export const MAX_PACKAGE_BYTES = 20 * 1024 * 1024 * 1024;
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function canonicalAsset(asset:PackageAsset):PackageAsset {
    return {
        hash: asset.hash,
        size: asset.size,
        kind: asset.kind,
        contentType: asset.contentType,
    };
}

function canonicalPayload(
    descriptor:PackageDescriptor,
    includeDigest = false,
):Record<string, unknown> {
    const value:Record<string, unknown> = {
        formatVersion: descriptor.formatVersion,
        permanentMapId: descriptor.permanentMapId,
        accessId: descriptor.accessId,
        releaseVersion: descriptor.releaseVersion,
        required: descriptor.required.map(canonicalAsset),
        optional: descriptor.optional.map(canonicalAsset),
    };
    if (includeDigest) {
        value.manifestDigest = descriptor.manifestDigest;
    }
    return value;
}

function validHashShape(hash:unknown):hash is string {
    return (
        (typeof hash === 'string' && /^[A-Za-z0-9_-]{43}$/.test(hash)) ||
        (typeof hash === 'string' && /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(hash))
    );
}

function decodeBase58(value:string):Buffer | null {
    let decoded = 0n;
    for (const character of value) {
        const digit = BASE58.indexOf(character);
        if (digit < 0) {
            return null;
        }
        decoded = decoded * 58n + BigInt(digit);
    }
    const bytes: number[] = [];
    while (decoded > 0n) {
        bytes.unshift(Number(decoded & 0xffn));
        decoded >>= 8n;
    }
    const zeroPrefixLength = value.match(/^1*/)?.[0].length ?? 0;
    const result = Buffer.concat([Buffer.alloc(zeroPrefixLength), Buffer.from(bytes)]);
    return result;
}

function verifyDigest(hash:string, digest:Buffer):boolean {
    if (/^[A-Za-z0-9_-]{43}$/.test(hash)) {
        return digest.toString('base64url') === hash;
    }
    const multihash = decodeBase58(hash);
    return Boolean(
        multihash &&
            multihash.length === 34 &&
            multihash[0] === 0x12 &&
            multihash[1] === 0x20 &&
            multihash.subarray(2).equals(digest),
    );
}

function validPathComponent(value:unknown, maxLength:number):value is string {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= maxLength &&
        /^[A-Za-z0-9_-]+$/.test(value)
    );
}

function validMimeToken(value:string):boolean {
    return value.length > 0 && /^[A-Za-z0-9!#$&^_.+-]+$/.test(value);
}

function validContentType(value:unknown):value is string {
    if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.length > 128 ||
        /[^\x20-\x7e]/.test(value)
    ) {
        return false;
    }
    const [mediaType, ...parameters] = value.split(';');
    const parts = mediaType.trim().split('/');
    if (parts.length !== 2 || parts.includes('*') || !parts.every(validMimeToken)) {
        return false;
    }
    return parameters.every((parameter) => {
        const separator = parameter.indexOf('=');
        if (separator < 0) {
            return false;
        }
        const name = parameter.slice(0, separator).trim();
        const parameterValue = parameter.slice(separator + 1).trim();
        return (
            validMimeToken(name) &&
            parameterValue.length > 0 &&
            !parameterValue.includes(';') &&
            /^[\x21-\x7e ]+$/.test(parameterValue)
        );
    });
}

function parseJson<T>(value:string | T, errorMessage:string):T {
    try {
        return (typeof value === 'string' ? JSON.parse(value) : value) as T;
    } catch {
        throw new Error(errorMessage);
    }
}

export function validateDescriptor(
    descriptorInput:string | PackageDescriptor,
    trustedKeyInput:string | TrustedSigningKey,
):PackageDescriptor {
    const descriptor = parseJson<PackageDescriptor>(descriptorInput, '地图资源描述符格式无效');
    const trusted = parseJson<TrustedSigningKey>(trustedKeyInput, '服务器签名公钥格式无效');
    if (!descriptor || typeof descriptor !== 'object' || !trusted || typeof trusted !== 'object') {
        throw new Error('地图资源描述符格式无效');
    }
    const signature = descriptor.signature;
    if (
        descriptor.formatVersion !== 1 ||
        signature?.algorithm !== 'ES256' ||
        signature?.keyId !== trusted.keyId ||
        !validPathComponent(descriptor.permanentMapId, 128) ||
        !validPathComponent(descriptor.accessId, 63) ||
        typeof descriptor.releaseVersion !== 'string' ||
        descriptor.releaseVersion.length === 0 ||
        Buffer.byteLength(descriptor.releaseVersion) > 128 ||
        /[\u0000-\u001f\u007f]/.test(descriptor.releaseVersion) ||
        typeof descriptor.manifestDigest !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(descriptor.manifestDigest) ||
        !Array.isArray(descriptor.required) ||
        !Array.isArray(descriptor.optional) ||
        descriptor.required.length > MAX_ASSET_COUNT ||
        descriptor.optional.length > MAX_ASSET_COUNT
    ) {
        throw new Error('地图资源描述符与服务器信任信息不匹配');
    }
    for (const field of ['kty', 'crv', 'x', 'y']) {
        if (signature.publicKey?.[field] !== trusted.publicKey?.[field]) {
            throw new Error('地图资源描述符签名公钥与服务器引导公钥不匹配');
        }
    }

    const hashes = new Set();
    let totalBytes = 0;
    // 服务端允许空文件；0 字节仍需通过清单摘要与签名校验。
    for (const asset of [...descriptor.required, ...descriptor.optional]) {
        if (
            !asset ||
            !validHashShape(asset.hash) ||
            !Number.isSafeInteger(asset.size) ||
            asset.size < 0 ||
            asset.size > MAX_ASSET_BYTES ||
            asset.kind !== 'static' ||
            !validContentType(asset.contentType)
        ) {
            throw new Error('签名资源清单中包含无效或不受支持的资源');
        }
        if (hashes.has(asset.hash)) {
            throw new Error('地图资源描述符包含重复资源');
        }
        hashes.add(asset.hash);
        totalBytes += asset.size;
        if (totalBytes > MAX_PACKAGE_BYTES) {
            throw new Error('地图资源包超出启动器总大小上限');
        }
    }

    const manifestDigest = crypto
        .createHash('sha256')
        .update(JSON.stringify(canonicalPayload(descriptor)))
        .digest('base64url');
    if (manifestDigest !== descriptor.manifestDigest) {
        throw new Error('地图资源描述符摘要校验失败');
    }
    let publicKey;
    let signatureBytes;
    try {
        publicKey = crypto.createPublicKey({
            key: { kty: 'EC', crv: 'P-256', x: signature.publicKey.x, y: signature.publicKey.y },
            format: 'jwk',
        });
        signatureBytes = Buffer.from(signature.value, 'base64url');
    } catch {
        throw new Error('地图资源描述符签名格式无效');
    }
    const signedBytes = Buffer.from(JSON.stringify(canonicalPayload(descriptor, true)));
    if (
        signatureBytes.length !== 64 ||
        !crypto.verify(
            'sha256',
            signedBytes,
            { key: publicKey, dsaEncoding: 'ieee-p1363' },
            signatureBytes,
        )
    ) {
        throw new Error('地图资源描述符签名校验失败');
    }
    return descriptor;
}

export function verifyHashBytes(hash:string, bytes:Buffer, expectedSize:number):boolean {
    if (!Buffer.isBuffer(bytes) || bytes.byteLength !== expectedSize) {
        return false;
    }
    return verifyDigest(hash, crypto.createHash('sha256').update(bytes).digest());
}

export { validContentType, validHashShape };

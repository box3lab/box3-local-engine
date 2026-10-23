'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');
const { spawnSync } = require('child_process');
const { ensurePlayImageArchive, getPlayImageConfig } = require('./play-image');
const { generateDistributionMetadata } = require('./distribution-metadata');
const { scanProjectCompatibility } = require('./project-compatibility');
const { createMapGroupManager } = require('./map-group-manager');
const { createMapIdentity, mapIdentityPattern } = require('./map-identity');
const {
    assertAssetMode,
    readConfiguration: readAssetDistributionConfiguration,
    saveConfiguration: saveAssetDistributionConfiguration,
    uploadPublicAssets,
} = require('./asset-distribution');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '../..');
const projectsRoot = process.env.BOX_LOCAL_PROJECTS_PATH || path.join(packageRoot, 'projects');
const templateDataRoot = process.env.BOX_LOCAL_TEMPLATE_DATA_PATH || path.join(packageRoot, 'data');
const voxaDataRoot = process.env.BOX_LOCAL_VOXA_DATA_PATH || path.join(packageRoot, '../voxa/data');
const outputRoot = process.env.BOX_LOCAL_DIST_PATH || path.join(packageRoot, 'dist');
const distributionRoot = path.join(outputRoot, 'releases');
const projectExportRoot = path.join(outputRoot, 'projects');
const projectBackupRoot = process.env.BOX_PROJECT_BACKUP_PATH || path.join(packageRoot, 'backups');
const snapshotLimit = 5;
const projectImageMaxBytes = 3 * 1024 * 1024;
const projectImageMaxDataUrlBytes = Math.ceil(projectImageMaxBytes / 3) * 4 + 64;
const projectIdPattern = /^[a-z0-9][a-z0-9-]{0,62}$/;
const publicMapIdPattern = /^[a-z0-9][a-z0-9-]{0,62}$/;
const mapSizePresets = {
    small: [32, 32, 32],
    medium: [64, 128, 64],
    large: [128, 128, 128],
    huge: [256, 64, 256],
};
const customMapSizeLimits = {
    minimumAxis: 16,
    maximumWidthAndLength: 1024,
    maximumHeight: 128,
    maximumVoxels: 1024 * 128 * 1024,
};
const mapTemplatePresets = {
    blank: 'plane',
    arena: 'arena',
    raceway: 'raceway',
};
const mapGroupManager = createMapGroupManager(projectsRoot);
// Cloud runtime assets use both CIDv0 and URL-safe SHA-256 names. Embedded
// extraProject metadata is binary, so publishing must discover both forms or
// models, skins and shared scripts disappear from the play package.
const cidV0Pattern = /Qm[1-9A-HJ-NP-Za-km-z]{44}/g;
const urlSafeHashPattern = /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g;
const legacyUuidHashPattern =
    /(?<![0-9a-f])[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![0-9a-f])/gi;
const legacyUuidHashExactPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const sensitiveContentRules = [
    ['私钥', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
    ['数据库连接串', /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"']+:[^\s"'@]+@/i],
    ['云访问密钥', /\bAKIA[0-9A-Z]{16}\b/],
    ['GitHub 访问令牌', /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/],
    ['Slack 访问令牌', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
    ['OpenAI 风格密钥', /\bsk-[A-Za-z0-9_-]{20,}\b/],
    ['服主管理密钥', /\bBOX_PLAY_ADMIN_TOKEN\b/],
    [
        '硬编码密码或令牌',
        /\b(?:api[_-]?key|secret|password|passwd|access[_-]?token|refresh[_-]?token)\b\s*[:=]\s*["'][^"'\r\n]{12,}["']/i,
    ],
];
const removableDirectoryRetryErrors = new Set(['EBUSY', 'ENOTEMPTY', 'EPERM']);

function waitForFilesystemRetry(milliseconds) {
    if (milliseconds <= 0) {
        return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

/**
 * Docker Desktop may briefly report a bind-mounted directory as non-empty
 * while a previous copy/remove is still being synchronized. Retrying here is
 * important for import rollback: a cleanup error must never hide the actual
 * archive/import error shown to the creator.
 */
function removeDirectoryWithRetry(target, { retries = 5, retryDelay = 120, force = true } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            fs.rmSync(target, {
                recursive: true,
                force,
                maxRetries: 3,
                retryDelay,
            });
            return true;
        } catch (error) {
            lastError = error;
            if (!removableDirectoryRetryErrors.has(error?.code) || attempt === retries) {
                throw error;
            }
            waitForFilesystemRetry(retryDelay);
        }
    }
    throw lastError;
}

function rollbackDirectory(target) {
    try {
        removeDirectoryWithRetry(target);
    } catch (error) {
        // The caller is already handling a more useful import/copy error. Keep the
        // unfinished directory for diagnostics rather than replacing that error
        // with a misleading ENOTEMPTY cleanup failure.
        console.warn(`Unable to clean up local project directory ${target}: ${error.message}`);
    }
}

function isContentHash(hash) {
    return (
        /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(hash) ||
        /^[A-Za-z0-9_-]{43}$/.test(hash) ||
        legacyUuidHashExactPattern.test(hash)
    );
}

function normalizedContentHash(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    if (/^[A-Za-z0-9_-]{43}$/.test(value)) {
        return value;
    }
    if (legacyUuidHashExactPattern.test(value)) {
        return value;
    }
    const cid = value.match(
        /^(Qm[1-9A-HJ-NP-Za-km-z]{44})(?:\.(?:png|jpe?g|webp|gif|mp3|wav|ogg|m4a|lut))?$/i,
    );
    return cid?.[1];
}

function collectJSONReferencedHashes(value, hashes, hashExists) {
    if (typeof value === 'string') {
        const hash = normalizedContentHash(value);
        if (hash && hashExists(hash)) {
            hashes.add(hash);
        }
        return;
    }
    if (Array.isArray(value)) {
        for (const child of value) {
            collectJSONReferencedHashes(child, hashes, hashExists);
        }
        return;
    }
    if (!value || typeof value !== 'object') {
        return;
    }
    for (const [key, child] of Object.entries(value)) {
        // Previous editor history is not part of the runnable snapshot. Preview
        // images are included when their Blob exists so imported maps keep their
        // model thumbnails without old broken metadata blocking publication.
        if (key === 'prevHash') {
            continue;
        }
        collectJSONReferencedHashes(child, hashes, hashExists);
    }
}

function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    const entries = Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
}

function encodeBase58(buffer) {
    const digits = [0];
    for (const byte of buffer) {
        let carry = byte;
        for (let index = 0; index < digits.length; index += 1) {
            carry += digits[index] << 8;
            digits[index] = carry % 58;
            carry = Math.floor(carry / 58);
        }
        while (carry > 0) {
            digits.push(carry % 58);
            carry = Math.floor(carry / 58);
        }
    }
    let result = '';
    for (const byte of buffer) {
        if (byte !== 0) {
            break;
        }
        result += base58Alphabet[0];
    }
    for (let index = digits.length - 1; index >= 0; index -= 1) {
        result += base58Alphabet[digits[index]];
    }
    return result;
}

function contentHash(content) {
    const digest = crypto.createHash('sha256').update(content).digest();
    return encodeBase58(Buffer.concat([Buffer.from([0x12, 0x20]), digest]));
}

function storeReleaseBlob(releaseBlobRoot, content) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const hash = contentHash(buffer);
    const target = path.join(releaseBlobRoot, hash);
    fs.mkdirSync(releaseBlobRoot, { recursive: true });
    if (!fs.existsSync(target)) {
        fs.writeFileSync(target, buffer, { mode: 0o644 });
    }
    return hash;
}

function storeReleaseJSON(releaseBlobRoot, value) {
    return storeReleaseBlob(releaseBlobRoot, stableStringify(value));
}

function readBlobJSON(blobRoot, hash, label) {
    const target = path.join(blobRoot, hash || '');
    if (!hash || !fs.existsSync(target)) {
        throw new Error(`${label}不存在：${hash || 'empty hash'}`);
    }
    try {
        return JSON.parse(fs.readFileSync(target, 'utf8'));
    } catch {
        throw new Error(`${label}格式无效：${hash}`);
    }
}

function assertNoSensitiveContent(blobRoot, hashes) {
    for (const hash of hashes) {
        const target = path.join(blobRoot, hash);
        const stat = fs.statSync(target);
        if (!stat.isFile() || stat.size > 2 * 1024 * 1024) {
            continue;
        }
        const content = fs.readFileSync(target);
        if (content.includes(0)) {
            continue;
        }
        const text = content.toString('utf8');
        for (const [label, rule] of sensitiveContentRules) {
            if (rule.test(text)) {
                throw new Error(`发布已阻止：作品资源 ${hash} 包含疑似${label}，请移除后再发布`);
            }
        }
    }
}

function extractReferencedHashes(content, binaryHashExists = () => true) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const text = buffer.toString('utf8');
    const hashes = new Set();
    const isText = buffer.every((byte) => byte >= 32 || byte === 9 || byte === 10 || byte === 13);

    if (isText) {
        try {
            collectJSONReferencedHashes(JSON.parse(text), hashes, binaryHashExists);
            return hashes;
        } catch {
            // Scripts and generated source files are plain text but not JSON.
        }
        for (const hash of text.match(cidV0Pattern) || []) {
            hashes.add(hash);
        }
        for (const hash of text.match(urlSafeHashPattern) || []) {
            if (binaryHashExists(hash)) {
                hashes.add(hash);
            }
        }
        for (const hash of text.match(legacyUuidHashPattern) || []) {
            if (binaryHashExists(hash)) {
                hashes.add(hash);
            }
        }
        return hashes;
    }

    // extraProject and VOXA project blobs are protobuf-like binary documents.
    // Their URL-safe SHA-256 values are encoded as length-delimited 43-byte
    // strings (0x2b + hash). Searching every arbitrary 43-character byte run
    // also matches mesh/texture payload data and invents nonexistent resources.
    for (const hash of text.match(cidV0Pattern) || []) {
        if (binaryHashExists(hash)) {
            hashes.add(hash);
        }
    }
    for (let index = 0; index + 44 <= buffer.length; index += 1) {
        if (buffer[index] !== 43) {
            continue;
        }
        const candidate = buffer.subarray(index + 1, index + 44).toString('ascii');
        if (/^[A-Za-z0-9_-]{43}$/.test(candidate) && binaryHashExists(candidate)) {
            hashes.add(candidate);
        }
    }
    // Old platform resource indexes encode model and preview Blob IDs as
    // length-delimited UUID strings. Only accept the exact 36-byte encoding and
    // require a matching source Blob so arbitrary model bytes cannot become
    // invented dependencies.
    for (let index = 0; index + 37 <= buffer.length; index += 1) {
        if (buffer[index] !== 36) {
            continue;
        }
        const candidate = buffer.subarray(index + 1, index + 37).toString('ascii');
        if (legacyUuidHashExactPattern.test(candidate) && binaryHashExists(candidate)) {
            hashes.add(candidate);
        }
    }
    return hashes;
}

function collectReferencedHashes(target, hashes) {
    if (!fs.existsSync(target)) {
        return;
    }
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(target)) {
            collectReferencedHashes(path.join(target, entry), hashes);
        }
        return;
    }
    if (!stat.isFile() || stat.size > 32 * 1024 * 1024) {
        return;
    }
    const content = fs.readFileSync(target);
    for (const hash of extractReferencedHashes(content)) {
        hashes.add(hash);
    }
}

function getRuntimeTemplateHashes() {
    const manifest = readJSON(path.join(templateDataRoot, 'runtime-blobs.json'), null);
    if (Array.isArray(manifest?.hashes)) {
        return new Set(manifest.hashes);
    }

    const hashes = new Set();
    for (const target of [
        path.join(packageRoot, '../game/src/resource'),
        path.join(packageRoot, '../../services/game-server/dist/src/assets'),
        path.join(packageRoot, '../../services/game-server/src/assets'),
        path.join(packageRoot, '../../services/game-server/src/player/default-avatar.json'),
    ]) {
        collectReferencedHashes(target, hashes);
    }
    return hashes;
}

function materializeProjectBlob(blobRoot, hash) {
    const target = path.join(blobRoot, hash);
    if (fs.existsSync(target)) {
        return target;
    }

    // The editor can resolve project models and skins through the local VOXA
    // fallback without copying their bytes into source/blobs first. A published
    // world cannot depend on the authoring product, so make those referenced
    // blobs part of the editable project before walking the dependency graph.
    const voxaBlob = path.join(voxaDataRoot, 'blobs', hash);
    if (fs.existsSync(voxaBlob) && fs.statSync(voxaBlob).isFile()) {
        copyReadableFileSync(voxaBlob, target);
        return target;
    }

    throw new Error(`工程引用的资源不存在：${hash}`);
}

function projectBlobExists(blobRoot, hash) {
    return (
        fs.existsSync(path.join(blobRoot, hash)) ||
        fs.existsSync(path.join(voxaDataRoot, 'blobs', hash))
    );
}

function getReachableProjectHashes(blobRoot, rootHash) {
    const hashes = new Set();
    const pending = [rootHash];
    while (pending.length) {
        const hash = pending.pop();
        if (!hash || hashes.has(hash)) {
            continue;
        }
        const blobPath = materializeProjectBlob(blobRoot, hash);
        hashes.add(hash);
        const stat = fs.statSync(blobPath);
        if (stat.size > 32 * 1024 * 1024) {
            continue;
        }
        const content = fs.readFileSync(blobPath);
        for (const childHash of extractReferencedHashes(content, (candidate) =>
            projectBlobExists(blobRoot, candidate),
        )) {
            if (!hashes.has(childHash)) {
                pending.push(childHash);
            }
        }
    }
    return hashes;
}

// Docker Desktop bind mounts on macOS can turn fs.copyFileSync outputs into
// mode 0200 files. The container then cannot read its own exported resources.
// Copy through explicitly-created descriptors so the destination remains 0644.
function copyReadableFileSync(source, destination) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const sourceFd = fs.openSync(source, 'r');
    const destinationFd = fs.openSync(destination, 'w', 0o644);
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    try {
        let bytesRead;
        do {
            bytesRead = fs.readSync(sourceFd, buffer, 0, buffer.length, null);
            if (bytesRead) {
                fs.writeSync(destinationFd, buffer, 0, bytesRead);
            }
        } while (bytesRead);
    } finally {
        fs.closeSync(sourceFd);
        fs.closeSync(destinationFd);
    }
}

// fs.cpSync preserves source metadata while copying. On Docker Desktop's
// macOS bind mounts that can create destination blobs as mode 0200 and then
// fail while traversing the directory. Copy the template tree explicitly so
// every directory and blob gets a stable mode that the node runtime can use.
function copyReadableDirectorySync(source, destination) {
    fs.mkdirSync(destination, { recursive: true, mode: 0o755 });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        const sourcePath = path.join(source, entry.name);
        const destinationPath = path.join(destination, entry.name);
        if (entry.isDirectory()) {
            copyReadableDirectorySync(sourcePath, destinationPath);
        } else if (entry.isFile()) {
            copyReadableFileSync(sourcePath, destinationPath);
        } else {
            throw new Error(`本地模板包含不支持的文件类型：${sourcePath}`);
        }
    }
}

function createReleaseData(sourceRoot, releaseDataRoot, state) {
    const sourceBlobRoot = path.join(sourceRoot, 'blobs');
    const releaseBlobRoot = path.join(releaseDataRoot, 'blobs');
    const permission = readBlobJSON(sourceBlobRoot, state.permissionHash, '工程权限数据');
    const versionControl = readBlobJSON(sourceBlobRoot, permission.versionControl, '工程版本数据');
    const sourceProjectHash = versionControl?.branches?.master?.headHash;
    const project = readBlobJSON(sourceBlobRoot, sourceProjectHash, '工程地图数据');
    const scriptAssets = readBlobJSON(sourceBlobRoot, project.scriptAssets, '工程脚本索引');

    // A published world only needs the current project head. Remove editor
    // history, commit identity and asset ownership before creating the release.
    const publishedScriptAssets = {};
    const privateHashes = new Set();
    for (const [name, asset] of Object.entries(scriptAssets || {})) {
        publishedScriptAssets[name] = {
            ...asset,
            contentId: 0,
            ownerId: 0,
        };
        // Never upload source code to the publisher's public CDN. Client scripts
        // are still available from the signed play package when the browser needs
        // them, while server scripts remain inaccessible over HTTP as before.
        if (typeof asset?.hash === 'string') {
            privateHashes.add(asset.hash);
        }
    }
    const publishedScriptAssetsHash = storeReleaseJSON(releaseBlobRoot, publishedScriptAssets);
    const publishedProject = {
        ...project,
        committerId: 0,
        prevHash: '',
        scriptAssets: publishedScriptAssetsHash,
        timestamp: new Date(0).toISOString(),
    };
    const publishedProjectHash = storeReleaseJSON(releaseBlobRoot, publishedProject);

    // Permissions are required by the prebake schema, but user lists, groups,
    // collaborators and version history are editor-only private information.
    const publishedVersionControlHash = storeReleaseJSON(releaseBlobRoot, {
        branches: {
            master: { headHash: publishedProjectHash, name: 'master' },
        },
        currentBranch: 'master',
    });
    const emptyGroupsHash = storeReleaseJSON(releaseBlobRoot, {});
    const emptyUsersHash = storeReleaseJSON(releaseBlobRoot, {});
    const emptyBannedHash = storeReleaseJSON(releaseBlobRoot, []);
    const emptyCollaboratorsHash = storeReleaseJSON(releaseBlobRoot, []);
    const publishedPermissionHash = storeReleaseJSON(releaseBlobRoot, {
        ...permission,
        accessLevel: 1,
        banned: emptyBannedHash,
        collaborators: emptyCollaboratorsHash,
        groups: emptyGroupsHash,
        owner: 0,
        prevHash: '',
        timestamp: new Date(0).toISOString(),
        users: emptyUsersHash,
        versionControl: publishedVersionControlHash,
    });
    for (const hash of [
        publishedPermissionHash,
        publishedVersionControlHash,
        emptyGroupsHash,
        emptyUsersHash,
        emptyBannedHash,
        emptyCollaboratorsHash,
    ]) {
        privateHashes.add(hash);
    }

    const currentProjectHashes = new Set();
    for (const hash of extractReferencedHashes(stableStringify(publishedProject))) {
        if (hash === publishedScriptAssetsHash) {
            continue;
        }
        for (const reachable of getReachableProjectHashes(sourceBlobRoot, hash)) {
            currentProjectHashes.add(reachable);
        }
    }
    for (const asset of Object.values(publishedScriptAssets)) {
        for (const hash of [asset?.hash, asset?.previewImage]) {
            if (!hash) {
                continue;
            }
            for (const reachable of getReachableProjectHashes(sourceBlobRoot, hash)) {
                currentProjectHashes.add(reachable);
            }
        }
    }
    if (state.extraProjectHash) {
        for (const hash of getReachableProjectHashes(sourceBlobRoot, state.extraProjectHash)) {
            currentProjectHashes.add(hash);
        }
    }
    for (const hash of Object.values(state.skinPreviews || {})) {
        if (typeof hash !== 'string' || !hash) {
            continue;
        }
        for (const reachable of getReachableProjectHashes(sourceBlobRoot, hash)) {
            currentProjectHashes.add(reachable);
        }
    }
    for (const hash of Object.values(state.skinProjects || {})) {
        if (typeof hash !== 'string' || !hash) {
            continue;
        }
        for (const reachable of getReachableProjectHashes(sourceBlobRoot, hash)) {
            currentProjectHashes.add(reachable);
        }
    }
    assertNoSensitiveContent(sourceBlobRoot, currentProjectHashes);

    const hashes = getRuntimeTemplateHashes();
    for (const hash of currentProjectHashes) {
        hashes.add(hash);
    }

    fs.mkdirSync(releaseBlobRoot, { recursive: true });
    for (const hash of hashes) {
        const projectSource = path.join(sourceBlobRoot, hash);
        const templateSource = path.join(templateDataRoot, 'blobs', hash);
        const source = fs.existsSync(projectSource)
            ? projectSource
            : fs.existsSync(templateSource)
              ? templateSource
              : null;
        if (!source) {
            throw new Error(`发布所需的资源不存在：${hash}`);
        }
        copyReadableFileSync(source, path.join(releaseBlobRoot, hash));
    }
    const releaseState = {
        formatVersion: 1,
        permissionHash: publishedPermissionHash,
        extraProjectHash: state.extraProjectHash || '',
        ...(state.skinPreviews ? { skinPreviews: state.skinPreviews } : {}),
        ...(state.skinProjects ? { skinProjects: state.skinProjects } : {}),
        updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
        path.join(releaseDataRoot, 'project-state.json'),
        `${JSON.stringify(releaseState, null, 2)}\n`,
    );
    fs.writeFileSync(
        path.join(releaseDataRoot, 'private-blobs.json'),
        `${JSON.stringify({ formatVersion: 1, hashes: [...privateHashes].sort() }, null, 2)}\n`,
    );
    fs.writeFileSync(
        path.join(releaseDataRoot, 'runtime-blobs.json'),
        `${JSON.stringify(
            {
                formatVersion: 1,
                hashes: [
                    ...new Set([
                        ...hashes,
                        publishedScriptAssetsHash,
                        publishedProjectHash,
                        ...privateHashes,
                    ]),
                ].sort(),
            },
            null,
            2,
        )}\n`,
    );
    return releaseState;
}

function assertProjectId(id) {
    if (!projectIdPattern.test(id || '')) {
        throw new Error('Project ID must use lowercase letters, numbers, and hyphens');
    }
    return id;
}

function assertVersion(version) {
    if (!/^v?[0-9][a-zA-Z0-9.-]{0,62}$/.test(version || '')) {
        throw new Error(
            'Version must start with a number and contain only letters, numbers, dots, or hyphens',
        );
    }
    return version;
}

function projectRoot(id) {
    return path.join(projectsRoot, assertProjectId(id));
}

function readJSON(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        if (error && error.code === 'ENOENT' && fallback !== undefined) {
            return fallback;
        }
        throw error;
    }
}

function writeJSON(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
    fs.renameSync(temporaryPath, filePath);
}

function permanentMapIdExists(permanentMapId, excludeProjectId = '') {
    if (!fs.existsSync(projectsRoot)) {
        return false;
    }
    return fs.readdirSync(projectsRoot, { withFileTypes: true }).some((entry) => {
        if (!entry.isDirectory() || entry.name === excludeProjectId) {
            return false;
        }
        try {
            const metadata = readJSON(path.join(projectsRoot, entry.name, 'project.json'));
            return metadata?.permanentMapId === permanentMapId;
        } catch {
            return false;
        }
    });
}

function createPermanentMapId() {
    for (;;) {
        const permanentMapId = createMapIdentity();
        if (!permanentMapIdExists(permanentMapId)) {
            return permanentMapId;
        }
    }
}

function validateProjectSource(sourceRoot) {
    const statePath = path.join(sourceRoot, 'project-state.json');
    const blobRoot = path.join(sourceRoot, 'blobs');
    const problems = [];
    let state;
    const initialized = fs.existsSync(statePath);
    if (!initialized) {
        return {
            ok: fs.existsSync(blobRoot) && fs.statSync(blobRoot).isDirectory(),
            initialized: false,
            problems: fs.existsSync(blobRoot) ? [] : ['缺少 blobs 目录'],
            state: undefined,
        };
    }
    try {
        state = readJSON(statePath);
    } catch (error) {
        problems.push(`project-state.json 无法读取：${error.message}`);
    }
    if (!fs.existsSync(blobRoot) || !fs.statSync(blobRoot).isDirectory()) {
        problems.push('缺少 blobs 目录');
    }
    if (!state?.permissionHash) {
        problems.push('缺少 permissionHash');
    } else if (!fs.existsSync(path.join(blobRoot, state.permissionHash))) {
        problems.push(`缺少权限根资源 ${state.permissionHash}`);
    } else {
        try {
            const permission = readJSON(path.join(blobRoot, state.permissionHash));
            if (permission.type !== 'permission' && permission.type !== 'permissions') {
                problems.push(`权限根资源类型无效：${permission.type || 'unknown'}`);
            }
        } catch (error) {
            problems.push(`权限根资源无法解析：${error.message}`);
        }
    }
    if (state?.extraProjectHash && !fs.existsSync(path.join(blobRoot, state.extraProjectHash))) {
        problems.push(`缺少项目资源索引 ${state.extraProjectHash}`);
    }
    return { ok: problems.length === 0, initialized: true, problems, state };
}

function snapshotRoot(id) {
    return path.join(projectRoot(id), '.snapshots');
}

function isConcurrentSnapshotChange(error) {
    return /file changed as we read it/i.test(String(error?.message || error));
}

function createProjectSnapshot(id, reason = 'automatic', options = {}) {
    const projectId = resolveProjectReference(id);
    const sourceRoot = path.join(projectRoot(projectId), 'source');
    const validation = validateProjectSource(sourceRoot);
    if (!validation.ok || !validation.initialized) {
        return { created: false, validation };
    }
    const root = snapshotRoot(id);
    fs.mkdirSync(root, { recursive: true });
    const signature = crypto
        .createHash('sha256')
        .update(JSON.stringify(validation.state))
        .digest('hex')
        .slice(0, 16);
    const existing = fs.readdirSync(root).find((name) => name.includes(`-${signature}.tar.gz`));
    if (existing) {
        return { created: false, validation, archivePath: path.join(root, existing) };
    }
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:.TZ]/g, '')
        .slice(0, 14);
    const archivePath = path.join(root, `${timestamp}-${reason}-${signature}.tar.gz`);
    try {
        (options.runTar || runTar)(
            ['-czf', archivePath, '-C', projectRoot(id), 'source'],
            '无法创建工程恢复快照',
        );
    } catch (error) {
        fs.rmSync(archivePath, { force: true });
        if (isConcurrentSnapshotChange(error)) {
            return {
                created: false,
                validation,
                skipped: 'source-changed',
            };
        }
        throw error;
    }
    const snapshots = fs
        .readdirSync(root)
        .filter((name) => name.endsWith('.tar.gz'))
        .sort()
        .reverse();
    for (const stale of snapshots.slice(snapshotLimit)) {
        fs.rmSync(path.join(root, stale), { force: true });
    }
    return { created: true, validation, archivePath };
}

function parseSnapshotInfo(name, root) {
    const match = name.match(/^(\d{14})-([a-z0-9-]+)-([a-f0-9]{16})\.tar\.gz$/i);
    if (!match) {
        return undefined;
    }
    const [, compactTimestamp, reason, signature] = match;
    const createdAt = `${compactTimestamp.slice(0, 4)}-${compactTimestamp.slice(4, 6)}-${compactTimestamp.slice(6, 8)}T${compactTimestamp.slice(8, 10)}:${compactTimestamp.slice(10, 12)}:${compactTimestamp.slice(12, 14)}.000Z`;
    const archivePath = path.join(root, name);
    return {
        name,
        reason,
        signature,
        createdAt,
        size: fs.statSync(archivePath).size,
    };
}

function listProjectSnapshots(id) {
    assertProjectId(id);
    getProject(id);
    const root = snapshotRoot(id);
    if (!fs.existsSync(root)) {
        return [];
    }
    return fs
        .readdirSync(root)
        .filter((name) => name.endsWith('.tar.gz'))
        .sort()
        .reverse()
        .map((name) => parseSnapshotInfo(name, root))
        .filter(Boolean);
}

function restoreProjectSnapshot(id, requestedSnapshot) {
    const root = snapshotRoot(id);
    const available = listProjectSnapshots(id);
    const snapshots = requestedSnapshot
        ? available.filter(({ name }) => name === requestedSnapshot).map(({ name }) => name)
        : available.map(({ name }) => name);
    if (requestedSnapshot && snapshots.length === 0) {
        throw new Error('所选工程恢复快照不存在');
    }
    for (const name of snapshots) {
        // Keep the extracted snapshot on the same filesystem as the project. In
        // Docker, /tmp belongs to the container layer while projectsRoot is often
        // a mounted volume; renameSync across those mounts fails with EXDEV. A
        // same-volume staging directory also preserves the atomic source swap and
        // rollback behavior below.
        const temporaryRoot = fs.mkdtempSync(path.join(projectRoot(id), '.box-project-restore-'));
        let brokenRoot;
        try {
            runTar(['-xzf', path.join(root, name), '-C', temporaryRoot], '无法读取工程恢复快照');
            const restoredSource = path.join(temporaryRoot, 'source');
            const validation = validateProjectSource(restoredSource);
            if (!validation.ok) {
                continue;
            }
            const sourceRoot = path.join(projectRoot(id), 'source');
            createProjectSnapshot(id, 'before-restore');
            brokenRoot = `${sourceRoot}.restore-backup-${process.pid}-${Date.now()}`;
            if (fs.existsSync(sourceRoot)) {
                fs.renameSync(sourceRoot, brokenRoot);
            }
            try {
                fs.renameSync(restoredSource, sourceRoot);
            } catch (error) {
                if (fs.existsSync(brokenRoot) && !fs.existsSync(sourceRoot)) {
                    fs.renameSync(brokenRoot, sourceRoot);
                }
                throw error;
            }
            if (brokenRoot) {
                fs.rmSync(brokenRoot, { recursive: true, force: true });
            }
            const metadata = getProject(id);
            metadata.updatedAt = new Date().toISOString();
            writeJSON(path.join(projectRoot(id), 'project.json'), metadata);
            return { restored: true, snapshot: name, validation };
        } finally {
            if (brokenRoot && fs.existsSync(brokenRoot)) {
                const sourceRoot = path.join(projectRoot(id), 'source');
                if (!fs.existsSync(sourceRoot)) {
                    fs.renameSync(brokenRoot, sourceRoot);
                } else {
                    fs.rmSync(brokenRoot, { recursive: true, force: true });
                }
            }
            fs.rmSync(temporaryRoot, { recursive: true, force: true });
        }
    }
    return { restored: false };
}

function restoreLatestProjectSnapshot(id) {
    return restoreProjectSnapshot(id);
}

function relativeTime(value) {
    const age = Math.max(0, Date.now() - new Date(value).getTime());
    const minutes = Math.floor(age / 60000);
    if (minutes < 1) {
        return '刚刚更新';
    }
    if (minutes < 60) {
        return `${minutes} 分钟前`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} 小时前`;
    }
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
}

function toProjectSummary(metadata) {
    const releases = Array.isArray(metadata.releases) ? metadata.releases : [];
    const latestRelease = releases.length ? releases[releases.length - 1] : undefined;
    return {
        id: metadata.id,
        permanentMapId: metadata.permanentMapId,
        publicId: metadata.publicId || metadata.id,
        name: metadata.name,
        description: metadata.description || '',
        updatedAt: relativeTime(metadata.updatedAt),
        updatedAtISO: metadata.updatedAt,
        status: releases.length ? '已发布' : '草稿',
        releaseCount: releases.length,
        author: metadata.author || '',
        cover: metadata.cover || '',
        loadingCover: metadata.loadingCover || '',
        latestRelease: latestRelease ? latestRelease.version : '',
        latestReleaseNotes: latestRelease?.notes || '',
        theme: metadata.theme || 'sunset',
        mapGroupId: metadata.mapGroupId,
        mapRole: metadata.mapRole,
        mainProjectId: metadata.mainProjectId,
        mapSize: metadata.mapSize || mapSizePresets.medium,
        templateId: metadata.templateId || 'blank',
    };
}

function getProject(id) {
    const root = projectRoot(id);
    const metadataPath = path.join(root, 'project.json');
    const metadata = readJSON(metadataPath);
    if (!metadata || metadata.id !== id) {
        throw new Error(`Invalid project metadata: ${id}`);
    }
    if (metadata.permanentMapId === undefined) {
        // Assign existing local projects one permanent identity exactly once.
        // Public route IDs and directory names are deliberately excluded.
        metadata.permanentMapId = createPermanentMapId();
        writeJSON(metadataPath, metadata);
    } else if (
        !mapIdentityPattern.test(metadata.permanentMapId) ||
        permanentMapIdExists(metadata.permanentMapId, id)
    ) {
        throw new Error(`Invalid or duplicate permanent map ID: ${id}`);
    }
    const validMapGroupIdentity =
        metadata.formatVersion === 1 &&
        typeof metadata.mapGroupId === 'string' &&
        metadata.mapGroupId.length > 0 &&
        ['main', 'submap'].includes(metadata.mapRole) &&
        typeof metadata.mainProjectId === 'string' &&
        metadata.mainProjectId.length > 0 &&
        (metadata.mapRole === 'main'
            ? metadata.mapGroupId === id && metadata.mainProjectId === id
            : metadata.mapGroupId === metadata.mainProjectId);
    if (!validMapGroupIdentity) {
        throw new Error(`Invalid map group metadata: ${id}`);
    }
    return metadata;
}

// Creator clients use the immutable permanent map ID, whereas legacy local
// management APIs still use the directory key. Accept both at this boundary
// so a CLI project configuration never depends on a mutable local path.
function resolveProjectReference(reference) {
    const value = String(reference || '').trim();
    try {
        return getProject(value).id;
    } catch (error) {
        if (!mapIdentityPattern.test(value)) {
            throw error;
        }
    }
    const project = listProjects().find((candidate) => candidate.permanentMapId === value);
    if (!project) {
        throw new Error(`Project not found: ${value}`);
    }
    return project.id;
}

function listProjects() {
    if (!fs.existsSync(projectsRoot)) {
        return [];
    }
    return fs
        .readdirSync(projectsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && projectIdPattern.test(entry.name))
        .flatMap((entry) => {
            try {
                return [toProjectSummary(getProject(entry.name))];
            } catch {
                return [];
            }
        })
        .sort((left, right) => right.updatedAtISO.localeCompare(left.updatedAtISO));
}

function assertPublicMapId(value) {
    const publicId = String(value || '')
        .trim()
        .toLowerCase();
    if (!publicMapIdPattern.test(publicId)) {
        throw new Error('地图 ID 只能包含小写字母、数字和连字符，长度为 1–63 个字符');
    }
    return publicId;
}

function publicMapIdExists(publicId, excludeProjectId = '') {
    return listProjects().some(
        (project) =>
            project.id !== excludeProjectId &&
            (project.id === publicId || project.publicId === publicId),
    );
}

function nextPublicMapId(value, excludeProjectId = '') {
    const preferred = assertPublicMapId(value);
    if (!publicMapIdExists(preferred, excludeProjectId)) {
        return preferred;
    }
    for (let index = 2; index < 10000; index += 1) {
        const suffix = `-${index}`;
        const candidate = `${preferred.slice(0, 63 - suffix.length)}${suffix}`;
        if (!publicMapIdExists(candidate, excludeProjectId)) {
            return candidate;
        }
    }
    throw new Error('无法生成唯一的地图 ID');
}

function normalizeMapSizePreset(value) {
    return Object.hasOwn(mapSizePresets, value) ? value : 'medium';
}

function normalizeMapSize(value) {
    if (!Array.isArray(value)) {
        return mapSizePresets[normalizeMapSizePreset(value)];
    }
    if (value.length !== 3) {
        throw new Error('自定义地图尺寸必须包含宽、高、长三个值');
    }
    const dimensions = value.map((axis) => Number(axis));
    const [width, height, length] = dimensions;
    if (
        dimensions.some(
            (axis) =>
                !Number.isInteger(axis) ||
                axis < customMapSizeLimits.minimumAxis ||
                axis % 16 !== 0,
        ) ||
        width > customMapSizeLimits.maximumWidthAndLength ||
        height > customMapSizeLimits.maximumHeight ||
        length > customMapSizeLimits.maximumWidthAndLength
    ) {
        throw new Error(
            '自定义地图尺寸：宽、长必须为 16 到 1024，高必须为 16 到 128，且均为 16 的倍数',
        );
    }
    const voxelCount = dimensions.reduce((total, axis) => total * axis, 1);
    if (voxelCount > customMapSizeLimits.maximumVoxels) {
        throw new Error('自定义地图尺寸过大，体素总数不能超过 134217728');
    }
    return dimensions;
}

function normalizeMapTemplatePreset(value) {
    return Object.hasOwn(mapTemplatePresets, value) ? value : 'blank';
}

function createProject({ id, name, author = '', description = '', mapSize }) {
    const safeId = assertProjectId(id);
    const normalizedMapSize = normalizeMapSize(mapSize);
    const root = projectRoot(safeId);
    if (fs.existsSync(root)) {
        throw new Error(`Project already exists: ${safeId}`);
    }
    if (publicMapIdExists(safeId)) {
        throw new Error(`地图 ID“${safeId}”已被其他项目使用`);
    }
    if (!name || !name.trim()) {
        throw new Error('Project name is required');
    }
    if (!fs.existsSync(templateDataRoot)) {
        throw new Error('Local Engine template data is missing');
    }

    fs.mkdirSync(root, { recursive: true, mode: 0o755 });
    try {
        if (path.resolve(templateDataRoot) === path.join(packageRoot, 'data')) {
            // The developer's blob directory also receives local uploads and
            // generated content. A new map starts with engine resources only.
            require('./runtime-assets').copyRuntimeData(
                path.resolve(packageRoot, '../..'),
                path.join(root, 'source'),
            );
        } else {
            // Explicit templates and Docker's staged runtime-data directory
            // retain their existing portable project format.
            copyReadableDirectorySync(templateDataRoot, path.join(root, 'source'));
        }
        const now = new Date().toISOString();
        const themes = ['sunset', 'ocean', 'forest', 'violet'];
        const metadata = {
            formatVersion: 1,
            id: safeId,
            permanentMapId: createPermanentMapId(),
            publicId: safeId,
            name: name.trim(),
            author: author.trim().slice(0, 80),
            description: description.trim(),
            theme: themes[listProjects().length % themes.length],
            createdAt: now,
            updatedAt: now,
            releases: [],
            mapGroupId: safeId,
            mapRole: 'main',
            mainProjectId: safeId,
            // These values are consumed only when the first edit runtime creates its
            // project state. Afterwards the voxel data in project-state.json is the
            // authoritative editable map, exactly as it is for imported projects.
            mapSize: normalizedMapSize,
            templateId: 'blank',
            terrainTheme: mapTemplatePresets.blank,
        };
        writeJSON(path.join(root, 'project.json'), metadata);
        return toProjectSummary(metadata);
    } catch (error) {
        // A failed first attempt must not leave a project that blocks retrying the
        // same map ID. Cleanup is best-effort because Docker Desktop may briefly
        // report a directory as busy while the bind mount is syncing.
        rollbackDirectory(root);
        throw error;
    }
}

function projectStorageIdentity(id) {
    const project = getProject(resolveProjectReference(id));
    const main = project.mainProjectId === project.id ? project : getProject(project.mainProjectId);
    return {
        permanentMapId: project.permanentMapId,
        permanentMapGroupId: main.permanentMapId,
    };
}

function mapGroupIdentity(id) {
    return mapGroupManager.identity(id);
}

function listMapGroup(id) {
    const identity = mapGroupIdentity(id);
    return listProjects()
        .filter((project) => project.mapGroupId === identity.mapGroupId)
        .sort((left, right) => {
            if (left.mapRole !== right.mapRole) {
                return left.mapRole === 'main' ? -1 : 1;
            }
            return left.updatedAtISO.localeCompare(right.updatedAtISO);
        });
}

function createSubmap(mainId, { id, name, description = '', mapSize }) {
    const main = getProject(mainId);
    const identity = mapGroupIdentity(mainId);
    if (identity.mapRole !== 'main' || identity.mainProjectId !== mainId) {
        throw new Error('只能在主地图下创建副地图');
    }
    const created = createProject({
        id,
        name,
        author: main.author || '',
        description,
        mapSize,
    });
    const metadata = getProject(created.id);
    metadata.mapGroupId = identity.mapGroupId;
    metadata.mapRole = 'submap';
    metadata.mainProjectId = mainId;
    metadata.updatedAt = new Date().toISOString();
    writeJSON(path.join(projectRoot(created.id), 'project.json'), metadata);
    mapGroupManager.ensure(mainId);
    mapGroupManager.materialize(created.id);
    return toProjectSummary(metadata);
}

function updateProject(id, patch) {
    const metadata = getProject(id);
    if (typeof patch.publicId === 'string') {
        const publicId = assertPublicMapId(patch.publicId);
        if (publicMapIdExists(publicId, id)) {
            throw new Error(`地图 ID“${publicId}”已被其他项目使用`);
        }
        metadata.publicId = publicId;
    }
    if (typeof patch.name === 'string' && patch.name.trim()) {
        metadata.name = patch.name.trim();
    }
    if (typeof patch.author === 'string') {
        metadata.author = patch.author.trim().slice(0, 80);
    }
    if (typeof patch.description === 'string') {
        metadata.description = patch.description.trim();
    }
    if (typeof patch.cover === 'string') {
        if (
            patch.cover &&
            (!/^data:image\/(png|jpeg|webp);base64,/.test(patch.cover) ||
                Buffer.byteLength(patch.cover, 'utf8') > projectImageMaxDataUrlBytes)
        ) {
            throw new Error('封面必须是小于 3MB 的 PNG、JPG 或 WebP 图片');
        }
        metadata.cover = patch.cover;
    }
    if (typeof patch.loadingCover === 'string') {
        if (
            patch.loadingCover &&
            (!/^data:image\/(png|jpeg|webp);base64,/.test(patch.loadingCover) ||
                Buffer.byteLength(patch.loadingCover, 'utf8') > projectImageMaxDataUrlBytes)
        ) {
            throw new Error('加载封面图必须是小于 3MB 的 PNG、JPG 或 WebP 图片');
        }
        metadata.loadingCover = patch.loadingCover;
    }
    metadata.updatedAt = new Date().toISOString();
    writeJSON(path.join(projectRoot(id), 'project.json'), metadata);
    return toProjectSummary(metadata);
}

function updateProjectMapSize(id, mapSize) {
    const metadata = getProject(id);
    metadata.mapSize = normalizeMapSize(mapSize);
    metadata.updatedAt = new Date().toISOString();
    writeJSON(path.join(projectRoot(id), 'project.json'), metadata);
    return toProjectSummary(metadata);
}

function runTar(args, message) {
    const result = spawnSync('tar', args, {
        encoding: 'utf8',
        // Keep ordinary tar failures readable without allowing the Node default
        // 1 MiB child-process buffer to abort larger project operations.
        maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${message}: ${result.stderr || result.stdout || 'tar failed'}`);
    }
    return result.stdout;
}

function forEachFileLineSync(filePath, visit) {
    const descriptor = fs.openSync(filePath, 'r');
    const chunk = Buffer.allocUnsafe(64 * 1024);
    let pending = '';
    try {
        while (true) {
            const bytesRead = fs.readSync(descriptor, chunk, 0, chunk.length, null);
            if (!bytesRead) {
                break;
            }
            pending += chunk.toString('utf8', 0, bytesRead);
            let newline = pending.indexOf('\n');
            while (newline >= 0) {
                visit(pending.slice(0, newline).replace(/\r$/, ''));
                pending = pending.slice(newline + 1);
                newline = pending.indexOf('\n');
            }
            if (pending.length > 16 * 1024) {
                throw new Error('工程包包含过长的文件路径');
            }
        }
        if (pending) {
            visit(pending.replace(/\r$/, ''));
        }
    } finally {
        fs.closeSync(descriptor);
    }
}

function writeMapGroupArchive(id, archivePath, snapshotReason, options = {}) {
    const identity = mapGroupIdentity(id);
    const singleMap = options.scope === 'map';
    const members = singleMap ? [toProjectSummary(getProject(id))] : listMapGroup(id);
    const archiveIdentity = singleMap ? { mapGroupId: id, mainProjectId: id } : identity;
    for (const member of members) {
        mapGroupManager.materialize(member.id);
        if (snapshotReason) {
            createProjectSnapshot(member.id, snapshotReason);
        }
    }
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'box-map-group-export-'));
    try {
        const projectsDirectory = path.join(temporaryRoot, 'projects');
        fs.mkdirSync(projectsDirectory, { recursive: true });
        for (const member of members) {
            const memberRoot = projectRoot(member.id);
            const destination = path.join(projectsDirectory, member.id);
            fs.mkdirSync(destination, { recursive: true });
            copyReadableFileSync(
                path.join(memberRoot, 'project.json'),
                path.join(destination, 'project.json'),
            );
            fs.cpSync(path.join(memberRoot, 'source'), path.join(destination, 'source'), {
                recursive: true,
                dereference: true,
            });
            if (member.id === archiveIdentity.mainProjectId) {
                const groupState = readJSON(mapGroupManager.paths(member.id).statePath);
                if (singleMap) {
                    groupState.mapGroupId = id;
                    if (
                        groupState.projectModelPathsByMap &&
                        typeof groupState.projectModelPathsByMap === 'object' &&
                        !Array.isArray(groupState.projectModelPathsByMap)
                    ) {
                        groupState.projectModelPathsByMap =
                            groupState.projectModelPathsByMap[id] === undefined
                                ? {}
                                : { [id]: groupState.projectModelPathsByMap[id] };
                    }
                    writeJSON(path.join(destination, 'group-state.json'), groupState);
                } else {
                    writeJSON(path.join(destination, 'group-state.json'), groupState);
                }
            }
        }
        writeJSON(path.join(temporaryRoot, 'group.json'), {
            formatVersion: 2,
            type: 'map-group',
            mapGroupId: archiveIdentity.mapGroupId,
            mainProjectId: archiveIdentity.mainProjectId,
            // Remember which card initiated the export. Importing as a submap uses
            // this member, while importing independently restores the whole group.
            exportedProjectId: id,
            exportedAt: new Date().toISOString(),
            members: members.map((member) => ({
                id: member.id,
                publicId: member.publicId || member.id,
                name: member.name,
                mapRole: singleMap ? 'main' : member.mapRole,
                mainProjectId: archiveIdentity.mainProjectId,
            })),
        });
        runTar(
            ['-czf', archivePath, '-C', temporaryRoot, 'group.json', 'projects'],
            'Unable to export map group',
        );
        archiveEntriesAreSafe(archivePath);
    } finally {
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
    return { identity, members };
}

function exportProject(id, options = {}) {
    const scope = options.scope || 'group';
    if (!['map', 'group'].includes(scope)) {
        throw new Error('不支持的工程导出范围');
    }
    const metadata = getProject(id);
    const identity = mapGroupIdentity(id);
    if (scope === 'group' && identity.mapRole !== 'main') {
        throw new Error('只有主地图可以导出地图组工程');
    }
    fs.mkdirSync(projectExportRoot, { recursive: true });
    const safeName =
        metadata.name
            .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
            .trim()
            .slice(0, 80) || '作品';
    const filename =
        scope === 'map'
            ? `${safeName}_${id}.boxproject`
            : `${safeName}_${identity.mapGroupId}_地图组.boxproject`;
    const archivePath = path.join(projectExportRoot, filename);
    const { members } = writeMapGroupArchive(id, archivePath, 'export', { scope });
    return {
        archivePath,
        filename,
        name: metadata.name,
        mapCount: members.length,
        mapGroupId: scope === 'map' ? id : identity.mapGroupId,
        scope,
    };
}

function positiveInteger(value, fallback, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum) {
        return fallback;
    }
    return Math.min(parsed, maximum);
}

function getBackupConfiguration() {
    return {
        enabled: /^(1|true|yes|on)$/i.test(process.env.BOX_AUTO_BACKUP_ENABLED || ''),
        intervalMinutes: positiveInteger(
            process.env.BOX_AUTO_BACKUP_INTERVAL_MINUTES,
            60,
            1,
            10080,
        ),
        retentionCount: positiveInteger(process.env.BOX_AUTO_BACKUP_RETENTION_COUNT, 24, 1, 1000),
        retentionDays: positiveInteger(process.env.BOX_AUTO_BACKUP_RETENTION_DAYS, 30, 1, 3650),
        backupRoot: projectBackupRoot,
    };
}

function backupStatusPath() {
    return path.join(projectBackupRoot, '.status.json');
}

function readBackupStatus() {
    const fallback = {
        state: 'idle',
        lastStartedAt: '',
        lastCompletedAt: '',
        completedProjects: 0,
        totalProjects: 0,
        created: 0,
        skipped: 0,
        failed: [],
    };
    try {
        return readJSON(backupStatusPath(), fallback);
    } catch (error) {
        return {
            ...fallback,
            state: 'warning',
            failed: [{ projectId: '', projectName: '备份状态', message: error.message }],
        };
    }
}

function writeBackupStatus(value) {
    writeJSON(backupStatusPath(), value);
    return value;
}

function backupDirectory(id) {
    return path.join(projectBackupRoot, mapGroupIdentity(id).mainProjectId);
}

function pruneProjectBackups(id, configuration = getBackupConfiguration()) {
    const root = backupDirectory(id);
    if (!fs.existsSync(root)) {
        return;
    }
    const expiresBefore = Date.now() - configuration.retentionDays * 24 * 60 * 60 * 1000;
    const backups = fs
        .readdirSync(root)
        .filter((name) => name.endsWith('.boxproject'))
        .map((name) => ({
            name,
            path: path.join(root, name),
            stat: fs.statSync(path.join(root, name)),
        }))
        .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs);
    for (const [index, backup] of backups.entries()) {
        if (index >= configuration.retentionCount || backup.stat.mtimeMs < expiresBefore) {
            fs.rmSync(backup.path, { force: true });
        }
    }
}

function parseProjectBackup(id, name) {
    const mainProjectId = mapGroupIdentity(id).mainProjectId;
    const target = path.join(backupDirectory(mainProjectId), name);
    const match = name.match(/^(\d{14})-([a-z0-9-]+)-([a-f0-9]{16})\.boxproject$/i);
    if (!match || !fs.existsSync(target)) {
        return undefined;
    }
    const [, compactTimestamp, reason, signature] = match;
    return {
        name,
        projectId: mainProjectId,
        reason,
        signature,
        createdAt: `${compactTimestamp.slice(0, 4)}-${compactTimestamp.slice(4, 6)}-${compactTimestamp.slice(6, 8)}T${compactTimestamp.slice(8, 10)}:${compactTimestamp.slice(10, 12)}:${compactTimestamp.slice(12, 14)}.000Z`,
        size: fs.statSync(target).size,
    };
}

function listProjectBackups(id) {
    getProject(id);
    const root = backupDirectory(id);
    if (!fs.existsSync(root)) {
        return [];
    }
    return fs
        .readdirSync(root)
        .filter((name) => name.endsWith('.boxproject'))
        .sort()
        .reverse()
        .map((name) => parseProjectBackup(id, name))
        .filter(Boolean);
}

function resolveProjectBackup(id, requestedName) {
    getProject(id);
    if (typeof requestedName !== 'string' || path.basename(requestedName) !== requestedName) {
        throw new Error('备份文件名无效');
    }
    const backup = parseProjectBackup(id, requestedName);
    if (!backup) {
        throw new Error('工程备份不存在');
    }
    return { ...backup, archivePath: path.join(backupDirectory(id), requestedName) };
}

function createProjectBackup(id, reason = 'automatic') {
    if (!/^[a-z0-9-]+$/i.test(reason || '')) {
        throw new Error('备份原因无效');
    }
    const mainProjectId = mapGroupIdentity(id).mainProjectId;
    const members = listMapGroup(mainProjectId);
    for (const member of members) {
        mapGroupManager.materialize(member.id);
    }
    const validations = members.map((member) => ({
        projectId: member.id,
        validation: validateProjectSource(path.join(projectRoot(member.id), 'source')),
    }));
    const invalid = validations.find(({ validation }) => !validation.ok || !validation.initialized);
    if (invalid) {
        return {
            created: false,
            projectId: mainProjectId,
            reason: 'uninitialized',
            validation: invalid.validation,
        };
    }
    const signature = crypto
        .createHash('sha256')
        .update(
            stableStringify({
                group: readJSON(mapGroupManager.paths(mainProjectId).statePath, {}),
                members: validations.map(({ projectId, validation }) => ({
                    projectId,
                    metadata: getProject(projectId),
                    state: validation.state,
                })),
            }),
        )
        .digest('hex')
        .slice(0, 16);
    const root = backupDirectory(mainProjectId);
    fs.mkdirSync(root, { recursive: true });
    const existing = fs.readdirSync(root).find((name) => name.endsWith(`-${signature}.boxproject`));
    if (existing) {
        pruneProjectBackups(id);
        return { created: false, projectId: mainProjectId, archivePath: path.join(root, existing) };
    }
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:.TZ]/g, '')
        .slice(0, 14);
    const archivePath = path.join(root, `${timestamp}-${reason}-${signature}.boxproject`);
    const temporaryPath = `${archivePath}.${process.pid}.tmp`;
    try {
        writeMapGroupArchive(
            mainProjectId,
            temporaryPath,
            reason === 'manual' ? 'manual' : 'automatic',
        );
        fs.renameSync(temporaryPath, archivePath);
    } finally {
        fs.rmSync(temporaryPath, { force: true });
    }
    pruneProjectBackups(mainProjectId);
    return { created: true, projectId: mainProjectId, archivePath };
}

function acquireBackupLock() {
    fs.mkdirSync(projectBackupRoot, { recursive: true });
    const lockPath = path.join(projectBackupRoot, '.backup.lock');
    try {
        fs.mkdirSync(lockPath);
    } catch (error) {
        if (error?.code !== 'EEXIST') {
            throw error;
        }
        const age = Date.now() - fs.statSync(lockPath).mtimeMs;
        if (age < 6 * 60 * 60 * 1000) {
            return undefined;
        }
        fs.rmSync(lockPath, { recursive: true, force: true });
        fs.mkdirSync(lockPath);
    }
    return () => fs.rmSync(lockPath, { recursive: true, force: true });
}

function runProjectBackups(reason = 'automatic') {
    const releaseLock = acquireBackupLock();
    if (!releaseLock) {
        return { running: true, status: readBackupStatus() };
    }
    const projects = listProjects().filter((project) => project.mapRole === 'main');
    const startedAt = new Date().toISOString();
    let created = 0;
    let skipped = 0;
    const failed = [];
    let completedProjects = 0;
    try {
        writeBackupStatus({
            state: 'running',
            lastStartedAt: startedAt,
            lastCompletedAt: readBackupStatus().lastCompletedAt || '',
            completedProjects,
            totalProjects: projects.length,
            created,
            skipped,
            failed,
        });
        for (const project of projects) {
            try {
                const result = createProjectBackup(project.id, reason);
                if (result.created) {
                    created += 1;
                } else {
                    skipped += 1;
                }
            } catch (error) {
                failed.push({
                    projectId: project.id,
                    projectName: project.name,
                    message: error.message,
                });
            }
            completedProjects += 1;
            writeBackupStatus({
                state: 'running',
                lastStartedAt: startedAt,
                lastCompletedAt: readBackupStatus().lastCompletedAt || '',
                completedProjects,
                totalProjects: projects.length,
                created,
                skipped,
                failed,
            });
        }
        return writeBackupStatus({
            state: failed.length ? 'warning' : 'ready',
            lastStartedAt: startedAt,
            lastCompletedAt: new Date().toISOString(),
            completedProjects,
            totalProjects: projects.length,
            created,
            skipped,
            failed,
        });
    } finally {
        releaseLock();
    }
}

function archiveEntriesAreSafe(archivePath) {
    // A map with many blobs can produce several megabytes of names from `tar
    // -tzf`. Direct spawnSync capture then throws ENOBUFS before validation. Send
    // the listing to disk and inspect it in bounded chunks instead.
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'box-project-list-'));
    const entryListPath = path.join(temporaryRoot, 'entries.txt');
    let outputDescriptor;
    try {
        outputDescriptor = fs.openSync(entryListPath, 'wx');
        const result = spawnSync('tar', ['-tzf', archivePath], {
            encoding: 'utf8',
            stdio: ['ignore', outputDescriptor, 'pipe'],
            maxBuffer: 16 * 1024 * 1024,
        });
        fs.closeSync(outputDescriptor);
        outputDescriptor = undefined;
        if (result.error) {
            throw result.error;
        }
        if (result.status !== 0) {
            throw new Error(`Unable to read project archive: ${result.stderr || 'tar failed'}`);
        }

        let hasGroupDescriptor = false;
        let hasProjects = false;
        let entryCount = 0;
        forEachFileLineSync(entryListPath, (entry) => {
            if (!entry) {
                return;
            }
            entryCount += 1;
            if (entryCount > 1_000_000) {
                throw new Error('工程包文件数量超过 100 万个');
            }
            if (entry.startsWith('/') || entry.includes('\\') || entry.split('/').includes('..')) {
                throw new Error('工程包包含不安全的文件路径');
            }
            const supportedGroupEntry =
                entry === 'group.json' || entry === 'projects' || entry.startsWith('projects/');
            if (!supportedGroupEntry) {
                throw new Error('工程包包含不支持的内容');
            }
            if (entry === 'group.json') {
                hasGroupDescriptor = true;
            }
            if (entry === 'projects/' || entry.startsWith('projects/')) {
                hasProjects = true;
            }
        });
        if (!hasGroupDescriptor || !hasProjects) {
            throw new Error('工程包必须使用地图组格式');
        }
    } finally {
        if (outputDescriptor !== undefined) {
            fs.closeSync(outputDescriptor);
        }
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
    return true;
}

function nextImportedId(id) {
    const base = assertProjectId(id).slice(0, 48);
    let candidate = `${base}-imported`;
    let index = 2;
    while (fs.existsSync(path.join(projectsRoot, candidate))) {
        candidate = `${base.slice(0, 58 - String(index).length)}-imported-${index}`;
        index += 1;
    }
    return candidate;
}

function normalizeImportedProjectPermissions(root) {
    const pending = [root];
    while (pending.length) {
        const target = pending.pop();
        fs.chmodSync(target, 0o755);
        for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
            const entryPath = path.join(target, entry.name);
            if (entry.isDirectory()) {
                pending.push(entryPath);
            } else if (entry.isFile()) {
                // Docker Desktop bind mounts can reject stat/lstat on macOS files
                // extracted with mode 0200. chmod must happen before any file stat.
                fs.chmodSync(entryPath, 0o644);
            } else {
                throw new Error(`工程包包含不支持的文件类型：${entryPath}`);
            }
        }
    }
}

function importProject(archivePath, options = {}) {
    if (!archivePath || !fs.existsSync(archivePath)) {
        throw new Error('未找到工程包');
    }
    archiveEntriesAreSafe(archivePath);
    // Extract outside the Docker Desktop bind mount first. On macOS, archive
    // entries with mode 0200 can become impossible for the container user to
    // stat or chmod once they have been created in the mounted projects path.
    const temporaryRoot = path.join(os.tmpdir(), `box-project-import-${process.pid}-${Date.now()}`);
    fs.mkdirSync(temporaryRoot, { recursive: true });
    try {
        runTar(['-xzf', archivePath, '-C', temporaryRoot], 'Unable to import project');
        normalizeImportedProjectPermissions(temporaryRoot);
        return importMapGroupDirectory(temporaryRoot, options);
    } finally {
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
}

function validateMapGroupDescriptor(temporaryRoot) {
    const descriptor = readJSON(path.join(temporaryRoot, 'group.json'));
    if (
        descriptor?.type !== 'map-group' ||
        ![1, 2].includes(descriptor.formatVersion) ||
        !Array.isArray(descriptor.members) ||
        descriptor.members.length === 0
    ) {
        throw new Error('地图组工程包描述无效');
    }
    const memberIds = descriptor.members.map((member) => assertProjectId(member?.id));
    if (
        new Set(memberIds).size !== memberIds.length ||
        !memberIds.includes(descriptor.mainProjectId)
    ) {
        throw new Error('地图组成员关系无效');
    }
    if (
        descriptor.exportedProjectId !== undefined &&
        !memberIds.includes(descriptor.exportedProjectId)
    ) {
        throw new Error('地图组导出入口无效');
    }
    return { descriptor, memberIds };
}

function importMapGroupAsSubmap(temporaryRoot, descriptor, targetMainProjectId) {
    const targetMain = getProject(assertProjectId(targetMainProjectId));
    const targetIdentity = mapGroupIdentity(targetMain.id);
    if (targetIdentity.mapRole !== 'main' || targetIdentity.mainProjectId !== targetMain.id) {
        throw new Error('只能把工程导入到主地图下');
    }
    const sourceId = descriptor.exportedProjectId || descriptor.mainProjectId;
    const sourceRoot = path.join(temporaryRoot, 'projects', sourceId);
    const sourceMetadata = readJSON(path.join(sourceRoot, 'project.json'));
    if (
        sourceMetadata?.id !== sourceId ||
        !sourceMetadata.name ||
        !fs.existsSync(path.join(sourceRoot, 'source'))
    ) {
        throw new Error(`地图组成员工程无效：${sourceId}`);
    }

    const id = nextImportedId(sourceId);
    const root = projectRoot(id);
    const now = new Date().toISOString();
    try {
        fs.mkdirSync(root, { recursive: true });
        // Do not use fs.cpSync for the final copy into the Docker Desktop bind
        // mount. It preserves an archive's directory modes, which can make the
        // destination source/ directory unreadable before this import gets a
        // chance to normalize permissions.
        copyReadableDirectorySync(path.join(sourceRoot, 'source'), path.join(root, 'source'));
        normalizeImportedProjectPermissions(root);
        writeJSON(path.join(root, 'project.json'), {
            formatVersion: 1,
            id,
            permanentMapId: createPermanentMapId(),
            publicId: nextPublicMapId(sourceMetadata.publicId || id),
            name: sourceMetadata.name,
            description: sourceMetadata.description || '',
            author: sourceMetadata.author || targetMain.author || '',
            cover: sourceMetadata.cover || '',
            loadingCover: sourceMetadata.loadingCover || '',
            theme: sourceMetadata.theme || 'sunset',
            createdAt: now,
            updatedAt: now,
            releases: [],
            mapGroupId: targetIdentity.mapGroupId,
            mapRole: 'submap',
            mainProjectId: targetMain.id,
        });
        writeJSON(
            path.join(root, 'compatibility.json'),
            scanProjectCompatibility(path.join(root, 'source')),
        );

        // Imported map resources remain readable by content hash, while shared
        // scripts, UI and libraries continue to come from the target map group.
        const targetBlobRoot = mapGroupManager.paths(targetMain.id).blobRoot;
        const importedBlobRoot = path.join(root, 'source', 'blobs');
        fs.mkdirSync(targetBlobRoot, { recursive: true });
        if (fs.existsSync(importedBlobRoot)) {
            for (const entry of fs.readdirSync(importedBlobRoot, { withFileTypes: true })) {
                if (!entry.isFile()) {
                    continue;
                }
                const destination = path.join(targetBlobRoot, entry.name);
                if (!fs.existsSync(destination)) {
                    fs.copyFileSync(path.join(importedBlobRoot, entry.name), destination);
                }
            }
        }
        mapGroupManager.ensure(targetMain.id);
        mapGroupManager.materialize(id);
        return {
            ...toProjectSummary(getProject(id)),
            importedMapCount: 1,
            importedAs: 'submap',
            sourceMapGroupId: descriptor.mapGroupId,
            compatibility: aggregateImportCompatibility([id]),
        };
    } catch (error) {
        rollbackDirectory(root);
        throw error;
    }
}

function aggregateImportCompatibility(projectIds) {
    const reports = projectIds.map((projectId) => {
        const project = getProject(projectId);
        return {
            project,
            report: readJSON(path.join(projectRoot(projectId), 'compatibility.json'), {}),
        };
    });
    const decorate = ({ project }, issue, level) => ({
        ...issue,
        level,
        projectId: project.id,
        projectName: project.name,
        message: `${project.name}：${issue.message}`,
    });
    const errors = reports.flatMap((entry) =>
        Array.isArray(entry.report.errors)
            ? entry.report.errors.map((issue) => decorate(entry, issue, 'error'))
            : [],
    );
    const warnings = reports.flatMap((entry) =>
        Array.isArray(entry.report.warnings)
            ? entry.report.warnings.map((issue) => decorate(entry, issue, 'warning'))
            : [],
    );
    return {
        generatedAt: new Date().toISOString(),
        level: errors.length ? 'error' : warnings.length ? 'warning' : 'compatible',
        summary: reports.reduce(
            (summary, { report }) => ({
                filesScanned: summary.filesScanned + Number(report.summary?.filesScanned || 0),
                scriptsScanned:
                    summary.scriptsScanned + Number(report.summary?.scriptsScanned || 0),
                warnings: summary.warnings + Number(report.summary?.warnings || 0),
                errors: summary.errors + Number(report.summary?.errors || 0),
                missingBlobCount:
                    summary.missingBlobCount + Number(report.summary?.missingBlobCount || 0),
            }),
            { filesScanned: 0, scriptsScanned: 0, warnings: 0, errors: 0, missingBlobCount: 0 },
        ),
        capabilities: [
            ...new Set(
                reports.flatMap(({ report }) =>
                    Array.isArray(report.capabilities) ? report.capabilities : [],
                ),
            ),
        ],
        errors,
        warnings,
    };
}

function importMapGroupDirectory(temporaryRoot, options = {}) {
    const { descriptor, memberIds } = validateMapGroupDescriptor(temporaryRoot);
    const mode = options.mode || 'independent';
    if (mode === 'submap') {
        if (!options.targetMainProjectId) {
            throw new Error('请选择副地图所属的主地图');
        }
        return importMapGroupAsSubmap(temporaryRoot, descriptor, options.targetMainProjectId);
    }
    if (mode !== 'independent') {
        throw new Error('不支持的工程导入方式');
    }
    const idMap = new Map();
    for (const oldId of memberIds) {
        idMap.set(oldId, nextImportedId(oldId));
    }
    const newMainId = idMap.get(descriptor.mainProjectId);
    const createdRoots = [];
    try {
        for (const member of descriptor.members) {
            const sourceRoot = path.join(temporaryRoot, 'projects', member.id);
            const metadata = readJSON(path.join(sourceRoot, 'project.json'));
            if (
                metadata?.id !== member.id ||
                !metadata.name ||
                !fs.existsSync(path.join(sourceRoot, 'source'))
            ) {
                throw new Error(`地图组成员工程无效：${member.id}`);
            }
            const id = idMap.get(member.id);
            const root = projectRoot(id);
            const now = new Date().toISOString();
            fs.mkdirSync(root, { recursive: true });
            createdRoots.push(root);
            // See the submap import path above: imported archives must be copied
            // with known-readable modes before they enter the mounted projects root.
            copyReadableDirectorySync(path.join(sourceRoot, 'source'), path.join(root, 'source'));
            normalizeImportedProjectPermissions(root);
            const imported = {
                formatVersion: 1,
                id,
                permanentMapId: createPermanentMapId(),
                publicId: nextPublicMapId(metadata.publicId || id),
                name: metadata.name,
                description: metadata.description || '',
                author: metadata.author || '',
                cover: metadata.cover || '',
                loadingCover: metadata.loadingCover || '',
                theme: metadata.theme || 'sunset',
                createdAt: now,
                updatedAt: now,
                releases: [],
                mapGroupId: newMainId,
                mapRole: member.id === descriptor.mainProjectId ? 'main' : 'submap',
                mainProjectId: newMainId,
            };
            writeJSON(path.join(root, 'project.json'), imported);
            writeJSON(
                path.join(root, 'compatibility.json'),
                scanProjectCompatibility(path.join(root, 'source')),
            );
        }
        // The imported main map owns the one authoritative shared root. Member
        // project-state files remain snapshots and are refreshed from this root.
        const importedGroupState = path.join(
            temporaryRoot,
            'projects',
            descriptor.mainProjectId,
            'group-state.json',
        );
        if (fs.existsSync(importedGroupState)) {
            const state = readJSON(importedGroupState);
            state.mapGroupId = newMainId;
            if (
                state.projectModelPathsByMap &&
                typeof state.projectModelPathsByMap === 'object' &&
                !Array.isArray(state.projectModelPathsByMap)
            ) {
                state.projectModelPathsByMap = Object.fromEntries(
                    Object.entries(state.projectModelPathsByMap)
                        .filter(([oldId]) => idMap.has(oldId))
                        .map(([oldId, paths]) => [idMap.get(oldId), paths]),
                );
            }
            writeJSON(path.join(projectRoot(newMainId), 'group-state.json'), state);
        } else {
            mapGroupManager.ensure(newMainId);
        }
        for (const id of idMap.values()) {
            mapGroupManager.materialize(id);
        }
        const main = toProjectSummary(getProject(newMainId));
        return {
            ...main,
            importedMapCount: memberIds.length,
            importedAs: 'independent',
            sourceMapGroupId: descriptor.mapGroupId,
            compatibility: aggregateImportCompatibility([...idMap.values()]),
        };
    } catch (error) {
        for (const root of createdRoots) {
            rollbackDirectory(root);
        }
        throw error;
    }
}

function deleteProject(id) {
    const root = projectRoot(id);
    if (!fs.existsSync(root)) {
        throw new Error(`Project does not exist: ${id}`);
    }
    const identity = mapGroupIdentity(id);
    const targets =
        identity.mapRole === 'main'
            ? listMapGroup(id).map((project) => projectRoot(project.id))
            : [root];
    for (const target of targets) {
        removeDirectoryWithRetry(target, { force: false });
    }
}

// Creator CLI writes source as a new immutable blob, then advances the project
// head. It never mutates a referenced blob in place, so an interrupted write
// leaves the previous editor state valid.
function updateProjectScript(id, side, entry, content) {
    if (!['client', 'server'].includes(side)) {
        throw new Error('Script side must be client or server');
    }
    if (!/^[A-Za-z0-9._-]{1,160}$/.test(entry) || entry.includes('..')) {
        throw new Error('Invalid script entry');
    }
    if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > 20 * 1024 * 1024) {
        throw new Error('Script content must be text up to 20 MiB');
    }
    // External Creator clients address maps by the permanent map ID. Resolve it
    // here as well as accepting the legacy local directory ID, before touching
    // any project files.
    const projectId = resolveProjectReference(id);
    const sourceRoot = path.join(projectRoot(projectId), 'source');
    const blobRoot = path.join(sourceRoot, 'blobs');
    const statePath = path.join(sourceRoot, 'project-state.json');
    const state = readJSON(statePath);
    const permission = readBlobJSON(blobRoot, state.permissionHash, '工程权限数据');
    const versionControl = readBlobJSON(blobRoot, permission.versionControl, '工程版本数据');
    const branch =
        versionControl.branches?.[versionControl.currentBranch || 'master'] ||
        versionControl.branches?.master;
    if (!branch?.headHash) {
        throw new Error('工程缺少当前版本头');
    }
    const project = readBlobJSON(blobRoot, branch.headHash, '工程地图数据');
    const scriptAssets = readBlobJSON(blobRoot, project.scriptAssets, '工程脚本索引');
    const scriptHash = storeReleaseBlob(blobRoot, Buffer.from(content, 'utf8'));

    // A normal script uploaded through Creator is shared by default. Shared
    // scripts live in the map-group extra-project snapshot rather than in the
    // cold project asset index. The engine intentionally excludes its two entry
    // scripts from sharing, so they remain ordinary, map-local assets.
    if (!['index.js', 'clientIndex.js'].includes(entry)) {
        const group = mapGroupManager.paths(projectId);
        const groupState = mapGroupManager.ensure(projectId);
        const { ExtraProjectInfoSchema, MuReadStream, MuWriteStream } = creatorSharedScriptCodec();
        let extraProject;
        if (groupState.extraProjectHash) {
            const extraPath = path.join(group.blobRoot, groupState.extraProjectHash);
            if (!fs.existsSync(extraPath)) {
                throw new Error(`缺少共享脚本索引 ${groupState.extraProjectHash}`);
            }
            const bytes = fs.readFileSync(extraPath);
            // A newly initialized map can persist an empty extra-project snapshot:
            // diff(identity, identity) produces zero bytes. That is a valid identity
            // value, but MuReadStream cannot decode a struct bitmask from an empty
            // buffer. Treat it as the schema identity before adding the first shared
            // script.
            if (bytes.length > 0) {
                const stream = new MuReadStream(bytes);
                // MuReadStream is a lightweight cursor over the supplied buffer; unlike
                // MuWriteStream it owns no allocation and deliberately has no destroy().
                extraProject = ExtraProjectInfoSchema.patch(
                    ExtraProjectInfoSchema.identity,
                    stream,
                );
            }
        }
        if (!extraProject) {
            extraProject = ExtraProjectInfoSchema.clone(ExtraProjectInfoSchema.identity);
        }
        const existingShared = Object.entries(extraProject.scriptAssets).find(
            ([, asset]) => asset.name === entry,
        );
        const fileId = existingShared?.[0] || crypto.randomUUID();
        const previous = existingShared?.[1];
        const nextOrder =
            previous?.order ??
            Math.max(
                0,
                ...Object.values(extraProject.scriptAssets).map(
                    (asset) => Number(asset.order) || 0,
                ),
            ) + 1;
        extraProject.scriptAssets[fileId] = {
            hash: scriptHash,
            name: entry,
            isClient: side === 'client',
            isShare: true,
            order: nextOrder,
            lockedMapTitle: '',
            lockedMapId: 0,
            id: fileId,
        };
        const persisted = new MuWriteStream(1024);
        let extraProjectHash;
        try {
            ExtraProjectInfoSchema.diff(ExtraProjectInfoSchema.identity, extraProject, persisted);
            extraProjectHash = storeReleaseBlob(group.blobRoot, Buffer.from(persisted.bytes()));
        } finally {
            persisted.destroy();
            ExtraProjectInfoSchema.free(extraProject);
        }
        writeJSON(group.statePath, {
            ...groupState,
            extraProjectHash,
            revision: Math.max(1, Number(groupState.revision) || 1) + 1,
            updatedAt: new Date().toISOString(),
        });
        // Keep this map's local state and blob pool coherent immediately. Other
        // maps in the group read the same group-state snapshot on their next load.
        mapGroupManager.materialize(projectId);
        return { entry, side, revision: branch.headHash, hash: scriptHash, shared: true };
    }

    const existing = scriptAssets[entry] || {};
    const nextAssets = {
        ...scriptAssets,
        [entry]: {
            ...existing,
            hash: scriptHash,
            size: Buffer.byteLength(content, 'utf8'),
            type: side === 'server' ? 1 : 7,
        },
    };
    const nextAssetsHash = storeReleaseJSON(blobRoot, nextAssets);
    const nextProjectHash = storeReleaseJSON(blobRoot, {
        ...project,
        scriptAssets: nextAssetsHash,
        prevHash: branch.headHash,
        timestamp: new Date().toISOString(),
    });
    const branchName = versionControl.currentBranch || 'master';
    const nextVersionControlHash = storeReleaseJSON(blobRoot, {
        ...versionControl,
        branches: {
            ...versionControl.branches,
            [branchName]: { ...branch, headHash: nextProjectHash },
        },
    });
    const nextPermissionHash = storeReleaseJSON(blobRoot, {
        ...permission,
        versionControl: nextVersionControlHash,
    });
    writeJSON(statePath, {
        ...state,
        permissionHash: nextPermissionHash,
        updatedAt: new Date().toISOString(),
    });
    return { entry, side, revision: nextProjectHash, hash: scriptHash, shared: false };
}

function readProjectScript(id, side, entry) {
    if (!['client', 'server'].includes(side)) {
        throw new Error('Script side must be client or server');
    }
    if (!/^[A-Za-z0-9._-]{1,160}$/.test(entry) || entry.includes('..')) {
        throw new Error('Invalid script entry');
    }
    const projectId = resolveProjectReference(id);
    const group = mapGroupManager.paths(projectId);
    const groupState = mapGroupManager.ensure(projectId);
    if (!groupState.extraProjectHash) {
        throw new Error(`Script not found: ${side}/${entry}`);
    }
    const bytes = fs.readFileSync(path.join(group.blobRoot, groupState.extraProjectHash));
    if (!bytes.length) {
        throw new Error(`Script not found: ${side}/${entry}`);
    }
    const { ExtraProjectInfoSchema, MuReadStream } = creatorSharedScriptCodec();
    const stream = new MuReadStream(bytes);
    const extra = ExtraProjectInfoSchema.patch(ExtraProjectInfoSchema.identity, stream);
    try {
        const asset = Object.values(extra.scriptAssets).find(
            (value) => value.name === entry && value.isClient === (side === 'client'),
        );
        if (!asset || asset.isShare !== true) {
            throw new Error(`Shared script not found: ${side}/${entry}`);
        }
        return {
            entry,
            side,
            hash: asset.hash,
            shared: true,
            content: fs.readFileSync(path.join(group.blobRoot, asset.hash), 'utf8'),
        };
    } finally {
        ExtraProjectInfoSchema.free(extra);
    }
}

function listProjectSharedScripts(id) {
    const projectId = resolveProjectReference(id);
    const group = mapGroupManager.paths(projectId);
    const groupState = mapGroupManager.ensure(projectId);
    if (!groupState.extraProjectHash) {
        return { projectId: getProject(projectId).permanentMapId, scripts: [] };
    }
    const bytes = fs.readFileSync(path.join(group.blobRoot, groupState.extraProjectHash));
    if (!bytes.length) {
        return { projectId: getProject(projectId).permanentMapId, scripts: [] };
    }
    const { ExtraProjectInfoSchema, MuReadStream } = creatorSharedScriptCodec();
    const extra = ExtraProjectInfoSchema.patch(
        ExtraProjectInfoSchema.identity,
        new MuReadStream(bytes),
    );
    try {
        const scripts = Object.values(extra.scriptAssets)
            .filter((asset) => asset.isShare === true)
            .map((asset) => ({
                entry: asset.name,
                side: asset.isClient ? 'client' : 'server',
                hash: asset.hash,
                size: fs.statSync(path.join(group.blobRoot, asset.hash)).size,
                shared: true,
            }))
            .sort(
                (left, right) =>
                    left.side.localeCompare(right.side) || left.entry.localeCompare(right.entry),
            );
        return { projectId: getProject(projectId).permanentMapId, scripts };
    } finally {
        ExtraProjectInfoSchema.free(extra);
    }
}

function selectCreatorModelAssets(assets, groupState, projectId) {
    // Older projects store models in the map's general assets index. Modern
    // Creator imports keep the full project model library in shared map-group
    // metadata. The CLI is used to author scripts, so it must expose every
    // project model rather than only the paths already referenced by this map.
    const legacyModels = Object.fromEntries(
        Object.entries(assets || {}).filter(([assetPath]) => assetPath.startsWith('mesh/')),
    );
    const deletedPaths = new Set(
        Array.isArray(groupState?.deletedProjectModelPaths)
            ? groupState.deletedProjectModelPaths.filter(
                  (assetPath) => typeof assetPath === 'string',
              )
            : [],
    );
    const projectModels = Object.fromEntries(
        Object.entries(groupState?.modelProjects || {})
            .filter(
                ([modelName, hash]) =>
                    typeof modelName === 'string' && modelName && typeof hash === 'string' && hash,
            )
            .map(([modelName, hash]) => {
                const assetPath = `mesh/${modelName}.vb`;
                return [
                    assetPath,
                    {
                        hash,
                        previewImage: groupState.modelPreviews?.[modelName] || '',
                    },
                ];
            })
            .filter(([assetPath]) => !deletedPaths.has(assetPath)),
    );
    const groupPaths = groupState?.projectModelPathsByMap?.[projectId];
    if (!Array.isArray(groupPaths)) {
        return { ...legacyModels, ...projectModels };
    }

    const groupModels = Object.fromEntries(
        groupPaths
            .filter((assetPath) => typeof assetPath === 'string' && assetPath.startsWith('mesh/'))
            .map((assetPath) => {
                const modelName = path.basename(assetPath, path.extname(assetPath));
                return [
                    assetPath,
                    {
                        hash: groupState.modelProjects?.[modelName] || '',
                        previewImage: groupState.modelPreviews?.[modelName] || '',
                    },
                ];
            }),
    );
    return { ...legacyModels, ...projectModels, ...groupModels };
}

function selectCreatorAssetIndex(projectIndex, groupState, indexName, readGroupIndex) {
    const indexHash = groupState?.groupProjectMetaData?.hashes?.[indexName];
    if (typeof indexHash !== 'string' || !indexHash) {
        return projectIndex;
    }
    return readGroupIndex(indexHash, `地图组 ${indexName} 资源索引`);
}

function selectCreatorUiTree(projectUiTree, groupState, readGroupIndex) {
    return selectCreatorAssetIndex(projectUiTree, groupState, 'uiTree', readGroupIndex);
}

function getProjectResources(id) {
    const projectId = resolveProjectReference(id);
    const sourceRoot = path.join(projectRoot(projectId), 'source');
    const blobRoot = path.join(sourceRoot, 'blobs');
    const group = mapGroupManager.paths(projectId);
    const groupState = mapGroupManager.ensure(projectId);
    const state = readJSON(path.join(sourceRoot, 'project-state.json'));
    const permission = readBlobJSON(blobRoot, state.permissionHash, '工程权限数据');
    const versionControl = readBlobJSON(blobRoot, permission.versionControl, '工程版本数据');
    const branch =
        versionControl.branches?.[versionControl.currentBranch || 'master'] ||
        versionControl.branches?.master;
    if (!branch?.headHash) {
        throw new Error('工程缺少当前版本头');
    }
    const project = readBlobJSON(blobRoot, branch.headHash, '工程地图数据');
    const resolveIndex = (value, label) =>
        typeof value === 'string' ? readBlobJSON(blobRoot, value, label) : value || {};
    // The general asset index also stores LUTs and particle effects. Only mesh
    // entries can be assigned to the engine's GameModelAssets / mesh fields.
    const modelAssets = selectCreatorModelAssets(
        resolveIndex(project.assets, '资源索引'),
        groupState,
        projectId,
    );
    const uiTree = selectCreatorUiTree(
        resolveIndex(project.uiTree, 'UI 资源索引'),
        groupState,
        (hash, label) => readBlobJSON(group.blobRoot, hash, label),
    );
    const readGroupIndex = (hash, label) => readBlobJSON(group.blobRoot, hash, label);
    return {
        projectId: getProject(projectId).permanentMapId,
        modelAssets,
        pictureAssets: selectCreatorAssetIndex(
            resolveIndex(project.pictureAssets, '图片资源索引'),
            groupState,
            'pictureAssets',
            readGroupIndex,
        ),
        audioAssets: selectCreatorAssetIndex(
            resolveIndex(project.audioAssets, '音频资源索引'),
            groupState,
            'audioAssets',
            readGroupIndex,
        ),
        uiTree,
    };
}

function creatorSharedScriptCodec() {
    // The Creator web process and edit runtime deliberately share the canonical
    // MuDB codec. Resolve it from the deployed game-server package so this file
    // works both in the repository and in the slim Creator image.
    // Do not call `require()` with a calculated request here: when this module
    // is loaded by a Next API route, Webpack replaces that form with a limited
    // module context. `createRequire` stays a Node runtime resolver and follows
    // the deployed game-server dependency tree in both environments.
    const runtimeRequire = createRequire(path.join(repoRoot, 'services/game-server/package.json'));
    const { ExtraProjectInfoSchema } = runtimeRequire('@box/schema/project/hot-schema');
    const { MuReadStream, MuWriteStream } = runtimeRequire('@box/mudb/stream');
    return { ExtraProjectInfoSchema, MuReadStream, MuWriteStream };
}

function publishProject(id, requestedVersion, notes = '') {
    const metadata = getProject(id);
    const root = projectRoot(id);
    const sharedSnapshot = mapGroupManager.materialize(id);
    const sourceRoot = path.join(root, 'source');
    const state = readJSON(path.join(sourceRoot, 'project-state.json'), {});
    const compatibility = scanProjectCompatibility(sourceRoot);
    writeJSON(path.join(root, 'compatibility.json'), compatibility);
    if (!state.permissionHash) {
        throw new Error('请先打开该工程并在编辑器中保存一次，再发布为游玩包');
    }
    createProjectSnapshot(id, 'publish');

    const version = assertVersion(
        requestedVersion ||
            `v${new Date()
                .toISOString()
                .replace(/[-:.TZ]/g, '')
                .slice(0, 14)}`,
    );
    const releaseRoot = path.join(root, 'releases', version);
    if (fs.existsSync(releaseRoot)) {
        throw new Error(`Release already exists: ${version}`);
    }

    const release = {
        formatVersion: 1,
        id: metadata.id,
        permanentMapId: metadata.permanentMapId,
        permanentMapGroupId: projectStorageIdentity(id).permanentMapGroupId,
        publicId: metadata.publicId || metadata.id,
        projectName: metadata.name,
        author: metadata.author || '',
        description: metadata.description || '',
        cover: metadata.cover || '',
        loadingCover: metadata.loadingCover || '',
        theme: metadata.theme || 'sunset',
        version,
        createdAt: new Date().toISOString(),
        permissionHash: '',
        immutable: true,
        mapGroupId: sharedSnapshot.mapGroupId,
        mapRole: metadata.mapRole,
        mainProjectId: sharedSnapshot.mainProjectId,
        sharedRevision: sharedSnapshot.revision,
        notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : '',
    };
    const temporaryReleaseRoot = `${releaseRoot}.${process.pid}.tmp`;
    fs.rmSync(temporaryReleaseRoot, { recursive: true, force: true });
    try {
        fs.mkdirSync(temporaryReleaseRoot, { recursive: true });
        const releaseState = createReleaseData(
            sourceRoot,
            path.join(temporaryReleaseRoot, 'data'),
            state,
        );
        release.permissionHash = releaseState.permissionHash;
        writeJSON(path.join(temporaryReleaseRoot, 'manifest.json'), release);
        fs.renameSync(temporaryReleaseRoot, releaseRoot);
    } catch (error) {
        fs.rmSync(temporaryReleaseRoot, { recursive: true, force: true });
        throw error;
    }
    metadata.releases = [...(metadata.releases || []), release];
    metadata.updatedAt = release.createdAt;
    writeJSON(path.join(root, 'project.json'), metadata);
    return { ...release, compatibility };
}

function publishMapGroup(id, requestedVersion, notes = '') {
    const members = listMapGroup(id);
    const identity = mapGroupIdentity(id);
    if (identity.mapRole !== 'main' || identity.mainProjectId !== id) {
        throw new Error('只有主地图可以导出游戏包');
    }
    const version = assertVersion(
        requestedVersion ||
            `v${new Date()
                .toISOString()
                .replace(/[-:.TZ]/g, '')
                .slice(0, 14)}`,
    );
    if (!members.length) {
        throw new Error('地图组中没有可发布的地图');
    }
    const metadataSnapshots = new Map();

    // Validate every member before writing the first immutable release. A map
    // group is one deployment unit, so a half-published group is never valid.
    for (const member of members) {
        mapGroupManager.materialize(member.id);
        const state = readJSON(
            path.join(projectRoot(member.id), 'source', 'project-state.json'),
            {},
        );
        if (!state.permissionHash) {
            throw new Error(`请先打开并保存地图“${member.name}”，再发布地图组游玩包`);
        }
        if (fs.existsSync(path.join(projectRoot(member.id), 'releases', version))) {
            throw new Error(`Release already exists: ${version}`);
        }
        metadataSnapshots.set(member.id, getProject(member.id));
    }

    const published = [];
    try {
        for (const member of members) {
            published.push(publishProject(member.id, version, notes));
        }
    } catch (error) {
        // Validation above guarantees this version did not previously exist, so
        // every matching release directory belongs to this transaction. Restore
        // exact metadata snapshots as well, including their original timestamps.
        for (const member of members) {
            fs.rmSync(path.join(projectRoot(member.id), 'releases', version), {
                recursive: true,
                force: true,
            });
            writeJSON(
                path.join(projectRoot(member.id), 'project.json'),
                metadataSnapshots.get(member.id),
            );
        }
        throw error;
    }

    return {
        formatVersion: 1,
        type: 'map-group-release',
        mapGroupId: identity.mapGroupId,
        mainProjectId: identity.mainProjectId,
        version,
        mapCount: published.length,
        releases: published,
    };
}

function getLaunchTarget({ project, release }) {
    if (project && release) {
        throw new Error('Choose a project source or a release, not both');
    }
    if (project) {
        const root = projectRoot(project);
        if (!fs.existsSync(path.join(root, 'project.json'))) {
            throw new Error(`Project does not exist: ${project}`);
        }
        mapGroupManager.materialize(project);
        let validation = validateProjectSource(path.join(root, 'source'));
        if (!validation.ok) {
            const recovery = restoreLatestProjectSnapshot(project);
            if (!recovery.restored) {
                throw new Error(`工程数据不完整且没有可用快照：${validation.problems.join('；')}`);
            }
            validation = validateProjectSource(path.join(root, 'source'));
        }
        try {
            createProjectSnapshot(project, 'launch');
        } catch (error) {
            // A recovery snapshot is maintenance, not a runtime dependency. Boxes
            // starts from the validated project roots; a full/different filesystem
            // must not turn an otherwise healthy map launch into a permanent 500.
            console.warn(`Launch snapshot skipped for ${project}: ${error.message}`);
        }
        const metadata = getProject(project);
        return {
            kind: 'source',
            id: project,
            name: metadata.name,
            publicId: metadata.publicId,
            description: metadata.description,
            dataRoot: path.join(root, 'source'),
            statePath: path.join(root, 'source', 'project-state.json'),
            groupStatePath: mapGroupManager.paths(project).statePath,
            groupBlobRoot: mapGroupManager.paths(project).blobRoot,
            initialMapSize: Array.isArray(metadata.mapSize)
                ? metadata.mapSize
                : mapSizePresets.medium,
            initialTerrainTheme:
                typeof metadata.terrainTheme === 'string'
                    ? metadata.terrainTheme
                    : mapTemplatePresets[normalizeMapTemplatePreset(metadata.templateId)],
        };
    }
    if (release) {
        const [id, version, ...extra] = release.split('@');
        if (extra.length || !id || !version) {
            throw new Error('Release must use <project-id>@<version>');
        }
        const root = path.join(projectRoot(id), 'releases', assertVersion(version));
        const manifestPath = path.join(root, 'manifest.json');
        const dataRoot = path.join(root, 'data');
        const statePath = path.join(dataRoot, 'project-state.json');
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`发布版本不存在：${release}`);
        }
        const manifest = readJSON(manifestPath);
        if (manifest.id !== id || manifest.version !== version) {
            throw new Error(`发布清单与请求不一致：${release}`);
        }
        if (!fs.existsSync(dataRoot) || !fs.existsSync(statePath)) {
            throw new Error(`发布版本数据不完整：${release}`);
        }
        const state = readJSON(statePath);
        if (
            typeof manifest.permissionHash !== 'string' ||
            !manifest.permissionHash ||
            state.permissionHash !== manifest.permissionHash
        ) {
            throw new Error(`发布版本世界哈希不一致：${release}`);
        }
        return {
            kind: 'release',
            id,
            name: manifest.projectName,
            publicId: manifest.publicId,
            description: manifest.description,
            version,
            dataRoot,
            statePath,
            permissionHash: manifest.permissionHash,
        };
    }
    return undefined;
}

function includePlayImage(destination) {
    const config = ensurePlayImageArchive();
    copyReadableFileSync(config.archive, destination);
    return config;
}

function readReleaseAssetLists(releaseRoot) {
    const releaseDataRoot = path.join(releaseRoot, 'data');
    const runtimeManifest = readJSON(path.join(releaseDataRoot, 'runtime-blobs.json'), null);
    const privateManifest = readJSON(path.join(releaseDataRoot, 'private-blobs.json'), null);
    if (!Array.isArray(runtimeManifest?.hashes) || !Array.isArray(privateManifest?.hashes)) {
        throw new Error('发布版本缺少资源清单，请重新发布该版本');
    }
    for (const hash of [...runtimeManifest.hashes, ...privateManifest.hashes]) {
        if (typeof hash !== 'string' || !isContentHash(hash)) {
            throw new Error('发布版本的资源清单无效');
        }
    }
    return {
        runtimeHashes: runtimeManifest.hashes,
        privateHashes: new Set(privateManifest.hashes),
    };
}

function locateReleaseBlob(releaseRoot, sourceRoot, hash) {
    const candidates = [
        path.join(releaseRoot, 'data', 'blobs', hash),
        path.join(sourceRoot, 'blobs', hash),
    ];
    for (const candidate of candidates) {
        try {
            const stat = fs.statSync(candidate);
            if (stat.isFile()) {
                return candidate;
            }
        } catch (error) {
            if (!['EACCES', 'ENOENT', 'EPERM'].includes(error?.code)) {
                throw error;
            }
        }
    }
    throw new Error(`发布版本缺少资源：${hash}`);
}

function getExternalReleaseAssets(releases) {
    const assets = new Map();
    for (const { releaseRoot, sourceRoot } of releases) {
        const { runtimeHashes, privateHashes } = readReleaseAssetLists(releaseRoot);
        for (const hash of runtimeHashes) {
            if (privateHashes.has(hash) || assets.has(hash)) {
                continue;
            }
            const source = locateReleaseBlob(releaseRoot, sourceRoot, hash);
            assets.set(hash, { hash, path: source, size: fs.statSync(source).size });
        }
    }
    return [...assets.values()];
}

function copyReleaseWorld(releaseRoot, sourceRoot, destination, assetDistribution) {
    const releaseDataRoot = path.join(releaseRoot, 'data');
    const destinationDataRoot = path.join(destination, 'data');
    const { runtimeHashes, privateHashes } = readReleaseAssetLists(releaseRoot);
    const sourceManifest = readJSON(path.join(releaseRoot, 'manifest.json'));
    const externalHashes =
        assetDistribution?.mode === 'external-cdn'
            ? runtimeHashes.filter((hash) => !privateHashes.has(hash))
            : [];
    const manifest =
        assetDistribution?.mode === 'external-cdn'
            ? {
                  ...sourceManifest,
                  assetDistribution: {
                      ...assetDistribution,
                      hashes: externalHashes,
                  },
              }
            : sourceManifest;
    writeJSON(path.join(destination, 'manifest.json'), manifest);
    copyReadableFileSync(
        path.join(releaseDataRoot, 'project-state.json'),
        path.join(destinationDataRoot, 'project-state.json'),
    );
    copyReadableFileSync(
        path.join(releaseDataRoot, 'private-blobs.json'),
        path.join(destinationDataRoot, 'private-blobs.json'),
    );
    fs.writeFileSync(
        path.join(destinationDataRoot, 'runtime-blobs.json'),
        `${JSON.stringify({ formatVersion: 1, hashes: runtimeHashes }, null, 2)}\n`,
    );

    for (const hash of runtimeHashes) {
        // The non-private entries are immutable public assets already uploaded to
        // the publisher's CDN. Keep scripts, permissions and runtime metadata in
        // the package so a CDN never becomes a source of private project data.
        if (externalHashes.includes(hash)) {
            continue;
        }
        const destinationBlob = path.join(destinationDataRoot, 'blobs', hash);
        // Docker Desktop may report R_OK for an old 0200 file and still fail
        // with ENOENT when it is actually opened, so probe by copying it.
        copyReadableFileSync(locateReleaseBlob(releaseRoot, sourceRoot, hash), destinationBlob);
    }
}

function safeFilename(value, fallback) {
    return (
        String(value || '')
            .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
            .trim()
            .slice(0, 80) || fallback
    );
}

async function exportPlayBundle(reference, options = {}) {
    const assetMode = assertAssetMode(options.assetMode);
    const target = getLaunchTarget({ release: reference });
    const identity = mapGroupIdentity(target.id);
    if (identity.mapRole !== 'main' || identity.mainProjectId !== target.id) {
        throw new Error('只有主地图可以导出游戏包');
    }
    const members = listMapGroup(target.id);
    const main = getProject(identity.mainProjectId);
    const exportRoot = path.join(distributionRoot, '.exports');
    const nonce = `${process.pid}_${Date.now()}`;
    const temporaryRoot = path.join(
        exportRoot,
        `${identity.mapGroupId}_${target.version}_${nonce}`,
    );
    const worldsRoot = path.join(temporaryRoot, 'worlds');
    const filename = `${safeFilename(main.name, '作品')}_${identity.mapGroupId}_${safeFilename(target.version, 'latest')}.boxplay`;
    const archivePath = path.join(exportRoot, `${nonce}.boxplay`);

    fs.mkdirSync(exportRoot, { recursive: true });
    try {
        const manifests = [];
        const releases = [];
        for (const member of members) {
            const root = projectRoot(member.id);
            const releaseRoot = path.join(root, 'releases', target.version);
            const manifestPath = path.join(releaseRoot, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                throw new Error(`地图“${member.name}”尚未发布版本 ${target.version}`);
            }
            const manifest = readJSON(manifestPath);
            if (
                manifest.id !== member.id ||
                manifest.version !== target.version ||
                manifest.mapGroupId !== identity.mapGroupId ||
                manifest.mainProjectId !== identity.mainProjectId
            ) {
                throw new Error(`地图“${member.name}”的发布关系与地图组不一致，请重新发布`);
            }
            releases.push({
                member,
                root,
                releaseRoot,
                sourceRoot: path.join(root, 'source'),
                manifest,
            });
            manifests.push(manifest);
        }
        let assetDistribution;
        if (assetMode === 'oss') {
            const upload = await uploadPublicAssets(
                projectsRoot,
                getExternalReleaseAssets(releases),
            );
            assetDistribution = upload.distribution;
        }
        for (const release of releases) {
            copyReleaseWorld(
                release.releaseRoot,
                release.sourceRoot,
                path.join(worldsRoot, release.member.id),
                assetDistribution,
            );
        }
        writeJSON(path.join(temporaryRoot, 'bundle.json'), {
            formatVersion: 1,
            type: 'map-group-play-bundle',
            mapGroupId: identity.mapGroupId,
            permanentMapGroupId: projectStorageIdentity(identity.mainProjectId).permanentMapGroupId,
            mainProjectId: identity.mainProjectId,
            version: target.version,
            createdAt: new Date().toISOString(),
            ...(assetDistribution ? { assetDistribution } : {}),
            members: manifests.map((manifest) => ({
                id: manifest.id,
                permanentMapId: manifest.permanentMapId,
                publicId: manifest.publicId || manifest.id,
                name: manifest.projectName,
                mapRole: manifest.mapRole,
                mainProjectId: manifest.mainProjectId,
            })),
        });
        runTar(
            ['-czf', archivePath, '-C', temporaryRoot, 'bundle.json', 'worlds'],
            'Unable to export play bundle',
        );
        return {
            archivePath,
            temporaryRoot,
            filename,
            mapCount: members.length,
            mapGroupId: identity.mapGroupId,
        };
    } catch (error) {
        fs.rmSync(archivePath, { force: true });
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
        throw error;
    }
}

function packageProject(reference, outputDirectory, options = {}) {
    const target = getLaunchTarget({ release: reference });
    const releaseRoot = path.join(projectRoot(target.id), 'releases', target.version);
    const manifest = readJSON(path.join(releaseRoot, 'manifest.json'));
    const bundleName = `${target.id}-${target.version}`;
    const bundleRoot = outputDirectory
        ? path.resolve(outputDirectory)
        : path.join(distributionRoot, bundleName);
    if (fs.existsSync(bundleRoot)) {
        throw new Error(`Distribution already exists: ${bundleRoot}`);
    }

    let playImageConfig = getPlayImageConfig();
    const contents = [
        'world',
        'compose.yml',
        '.env.example',
        'README.md',
        'BUILD-INFO.json',
        'LICENSE.txt',
        'THIRD-PARTY-NOTICES.json',
        'SHA256SUMS',
    ];
    if (options.includeImages) {
        contents.push('play-image.tar');
    }
    const temporaryBundleRoot = `${bundleRoot}.${process.pid}.tmp`;

    fs.mkdirSync(path.dirname(bundleRoot), { recursive: true });
    fs.rmSync(temporaryBundleRoot, { recursive: true, force: true });
    try {
        fs.mkdirSync(temporaryBundleRoot, { recursive: true });
        copyReleaseWorld(
            releaseRoot,
            path.join(projectRoot(target.id), 'source'),
            path.join(temporaryBundleRoot, 'world'),
        );

        if (options.includeImages) {
            playImageConfig = includePlayImage(path.join(temporaryBundleRoot, 'play-image.tar'));
        }

        const generatedAt = new Date().toISOString();
        writeJSON(path.join(temporaryBundleRoot, 'release.json'), {
            formatVersion: 1,
            project: target.id,
            name: manifest.projectName,
            author: manifest.author || '',
            description: manifest.description || '',
            cover: manifest.cover || '',
            loadingCover: manifest.loadingCover || '',
            version: target.version,
            notes: manifest.notes || '',
            createdAt: generatedAt,
            permissionHash: manifest.permissionHash,
            permanentMapId: manifest.permanentMapId,
            mapGroupId: manifest.mapGroupId || manifest.id,
            permanentMapGroupId: manifest.permanentMapGroupId || manifest.permanentMapId,
            mapRole: manifest.mapRole,
            mainProjectId: manifest.mainProjectId || manifest.id,
            sharedRevision: manifest.sharedRevision || 1,
            image: playImageConfig.image,
            playerServiceImage: playImageConfig.playerServiceImage,
            platform: playImageConfig.platform,
            contents,
        });
        const groupStorageNamespace =
            manifest.permanentMapGroupId || manifest.mapGroupId || manifest.id;
        fs.writeFileSync(
            path.join(temporaryBundleRoot, 'compose.yml'),
            `services:\n  player-service:\n    platform: \${BOX_PLAY_PLATFORM:-${playImageConfig.platform}}\n    image: \${BOX_PLAYER_SERVICE_IMAGE:-${playImageConfig.playerServiceImage}}\n    restart: unless-stopped\n    mem_limit: \${BOX_PLAYER_SERVICE_MEMORY_LIMIT:-1g}\n    cpus: \${BOX_PLAYER_SERVICE_CPU_LIMIT:-1.0}\n    pids_limit: \${BOX_PLAYER_SERVICE_PIDS_LIMIT:-256}\n    environment:\n      BOX_DEPLOYMENT_MODE: player-service\n      NEXT_PUBLIC_APP_ENV: development\n      NEXT_PUBLIC_APP_EDITION: createra\n      NEXT_PUBLIC_APP_REGION: cn\n      BOX_PLAY_ADMIN_TOKEN: \${BOX_PLAY_ADMIN_TOKEN:-}\n      PERMISSION_TOKEN_SECRET: \${PERMISSION_TOKEN_SECRET:?请在 .env 中设置 PERMISSION_TOKEN_SECRET}\n      BOX_SERVER_PUBLIC_URL: \${BOX_PLAYER_SERVICE_PUBLIC_URL:-http://127.0.0.1:3213}\n      BOX_PLAYER_SERVICE_PUBLIC_URL: \${BOX_PLAYER_SERVICE_PUBLIC_URL:-http://127.0.0.1:3213}\n      BOX_PLAY_PUBLIC_URL: \${BOX_PLAY_PUBLIC_URL:-http://127.0.0.1:3000}\n      BOX_TRUST_PROXY: \${BOX_TRUST_PROXY:-false}\n      BOX_RUNTIME_IDENTITY_TTL_MS: \${BOX_RUNTIME_IDENTITY_TTL_MS:-300000}\n      BOX_DATABASE_URL: \${BOX_DATABASE_URL:?请在 .env 中设置 BOX_DATABASE_URL}\n      BOX_IDENTITY_DATABASE_SCHEMA: \${BOX_IDENTITY_DATABASE_SCHEMA:-box_identity}\n      BOX_PLAYER_REGISTRATION_ENABLED: \${BOX_PLAYER_REGISTRATION_ENABLED:-true}\n      BOX_LOGIN_RATE_LIMIT_MAX_ATTEMPTS: \${BOX_LOGIN_RATE_LIMIT_MAX_ATTEMPTS:-10}\n      BOX_LOGIN_RATE_LIMIT_WINDOW_MS: \${BOX_LOGIN_RATE_LIMIT_WINDOW_MS:-300000}\n      BOX_REGISTRATION_RATE_LIMIT_MAX_ATTEMPTS: \${BOX_REGISTRATION_RATE_LIMIT_MAX_ATTEMPTS:-5}\n      BOX_REGISTRATION_RATE_LIMIT_WINDOW_MS: \${BOX_REGISTRATION_RATE_LIMIT_WINDOW_MS:-3600000}\n      BOX_PLAYER_COOKIE_DOMAIN: \${BOX_PLAYER_COOKIE_DOMAIN:-}\n      BOX_DATABASE_POOL_SIZE: \${BOX_DATABASE_POOL_SIZE:-10}\n      BOX_DATABASE_SSL: \${BOX_DATABASE_SSL:-false}\n      BOX_DATABASE_SSL_REJECT_UNAUTHORIZED: \${BOX_DATABASE_SSL_REJECT_UNAUTHORIZED:-true}\n    ports:\n      - \"\${BOX_PLAYER_SERVICE_HOST_IP:-127.0.0.1}:\${BOX_PLAYER_SERVICE_PORT:-3213}:3213\"\n\n  play:\n    platform: \${BOX_PLAY_PLATFORM:-${playImageConfig.platform}}\n    image: \${BOX_PLAY_IMAGE:-${playImageConfig.image}}\n    restart: unless-stopped\n    mem_limit: \${BOX_PLAY_MEMORY_LIMIT:-4g}\n    cpus: \${BOX_PLAY_CPU_LIMIT:-2.0}\n    pids_limit: \${BOX_PLAY_PIDS_LIMIT:-1024}\n    depends_on:\n      player-service:\n        condition: service_healthy\n    environment:\n      BOX_DEPLOYMENT_MODE: play\n      BOX_WORLD_PATH: /app/world/data\n      BOX_WORLD_STATE_PATH: /app/world/data/project-state.json\n      BOX_WORLD_HASH: ${manifest.permissionHash}\n      BOX_WORLD_ID: ${manifest.id}\n      BOX_WORLD_PUBLIC_ID: ${manifest.publicId || manifest.id}\n      BOX_WORLD_GROUP_ID: ${groupStorageNamespace}\n      BOX_WORLD_MAIN_PROJECT_ID: ${manifest.mainProjectId || manifest.id}\n      BOX_WORLD_NAME: ${JSON.stringify(manifest.projectName)}\n      BOX_PLAY_ADMIN_TOKEN: \${BOX_PLAY_ADMIN_TOKEN:-}\n      BOX_LOCAL_PLAYER_LIMIT: \${BOX_LOCAL_PLAYER_LIMIT:-8}\n      PERMISSION_TOKEN_SECRET: \${PERMISSION_TOKEN_SECRET:?请在 .env 中设置 PERMISSION_TOKEN_SECRET}\n      BOX_SERVER_PUBLIC_URL: \${BOX_SERVER_PUBLIC_URL:-}\n      BOX_PLAYER_SERVICE_INTERNAL_URL: http://player-service:3213\n      BOX_PLAYER_SERVICE_PUBLIC_URL: \${BOX_PLAYER_SERVICE_PUBLIC_URL:-http://127.0.0.1:3213}\n      BOX_TRUST_PROXY: \${BOX_TRUST_PROXY:-false}\n      BOX_SESSION_TTL_MS: \${BOX_SESSION_TTL_MS:-60000}\n      BOX_SESSION_RATE_LIMIT_PER_MINUTE: \${BOX_SESSION_RATE_LIMIT_PER_MINUTE:-60}\n      BOX_RUNTIME_IDENTITY_TTL_MS: \${BOX_RUNTIME_IDENTITY_TTL_MS:-300000}\n      BOX_SCRIPT_HEAP_MB: \${BOX_SCRIPT_HEAP_MB:-512}\n      SCRIPT_MEMORY_LIMIT: \${BOX_SCRIPT_MEMORY_MB:-512}\n      BOX_PLAYER_REVOCATION_POLL_MS: \${BOX_PLAYER_REVOCATION_POLL_MS:-1000}\n      BOX_CREATE_SESSION_TIMEOUT_MS: \${BOX_CREATE_SESSION_TIMEOUT_MS:-120000}\n      BOX_PLAY_MAX_RUNTIMES: \${BOX_PLAY_MAX_RUNTIMES:-8}\n      BOX_RUNTIME_IDLE_TIMEOUT_MS: \${BOX_RUNTIME_IDLE_TIMEOUT_MS:-900000}\n      BOX_DATA_STORAGE_PATH: /app/storage\n      BOX_DATABASE_URL: \${BOX_DATABASE_URL:?请在 .env 中设置 BOX_DATABASE_URL}\n      BOX_DATABASE_SCHEMA: \${BOX_DATABASE_SCHEMA:-box_engine}\n      BOX_DATABASE_POOL_SIZE: \${BOX_DATABASE_POOL_SIZE:-10}\n      BOX_DATABASE_SSL: \${BOX_DATABASE_SSL:-false}\n      BOX_DATABASE_SSL_REJECT_UNAUTHORIZED: \${BOX_DATABASE_SSL_REJECT_UNAUTHORIZED:-true}\n      BOX_DATA_STORAGE_LOCK_TIMEOUT_MS: \${BOX_DATA_STORAGE_LOCK_TIMEOUT_MS:-10000}\n      BOX_DATA_STORAGE_NAMESPACE: \${BOX_DATA_STORAGE_NAMESPACE:-}\n      BOX_DATA_STORAGE_NAMESPACE_PREFIX: \${BOX_DATA_STORAGE_NAMESPACE_PREFIX:-}\n      BOX_GROUP_STORAGE_NAMESPACE: \${BOX_GROUP_STORAGE_NAMESPACE:-${groupStorageNamespace}}\n      REDIS_HOST: \${REDIS_HOST:-}\n      REDIS_PORT: \${REDIS_PORT:-6379}\n      REDIS_PASSWORD: \${REDIS_PASSWORD:-}\n      REDIS_DB: \${REDIS_DB:-0}\n      STORAGE_CACHE_REDIS_DB: \${STORAGE_CACHE_REDIS_DB:-1}\n      STORAGE_CACHE_REDIS_TTL: \${STORAGE_CACHE_REDIS_TTL:-240}\n    ports:\n      - \"\${BOX_PLAY_HOST_IP:-127.0.0.1}:\${BOX_PLAY_PORT:-3000}:3000\"\n    volumes:\n      - type: bind\n        source: ./world\n        target: /app/world\n        read_only: true\n        bind:\n          create_host_path: false\n      - type: bind\n        source: ./storage\n        target: /app/storage\n        bind:\n          create_host_path: true\n`,
        );
        const packagedComposePath = path.join(temporaryBundleRoot, 'compose.yml');
        const packagedCompose = fs
            .readFileSync(packagedComposePath, 'utf8')
            .replace('BOX_LOCAL_PLAYER_LIMIT:-8', 'BOX_LOCAL_PLAYER_LIMIT:-70')
            .replace(
                '      BOX_PLAY_PUBLIC_URL: ${BOX_PLAY_PUBLIC_URL:-http://127.0.0.1:3000}\n      BOX_TRUST_PROXY:',
                '      BOX_PLAY_PUBLIC_URL: ${BOX_PLAY_PUBLIC_URL:-http://127.0.0.1:3000}\n      BOX_PLAYER_LOGIN_URL: ${BOX_PLAYER_LOGIN_URL:-}\n      BOX_PLAYER_AUTH_API_KEY: ${BOX_PLAYER_AUTH_API_KEY:?请在 .env 中设置 BOX_PLAYER_AUTH_API_KEY}\n      BOX_PLAYER_AUTH_ALLOWED_ORIGINS: ${BOX_PLAYER_AUTH_ALLOWED_ORIGINS:-}\n      BOX_TRUST_PROXY:',
            )
            .replace(
                '      BOX_PLAYER_SERVICE_PUBLIC_URL: ${BOX_PLAYER_SERVICE_PUBLIC_URL:-http://127.0.0.1:3213}\n      BOX_TRUST_PROXY:',
                '      BOX_PLAYER_SERVICE_PUBLIC_URL: ${BOX_PLAYER_SERVICE_PUBLIC_URL:-http://127.0.0.1:3213}\n      BOX_PLAY_PUBLIC_URL: ${BOX_PLAY_PUBLIC_URL:-http://127.0.0.1:3000}\n      BOX_PLAYER_LOGIN_URL: ${BOX_PLAYER_LOGIN_URL:-}\n      BOX_TRUST_PROXY:',
            )
            .replace(
                '      BOX_PLAY_PUBLIC_URL: ${BOX_PLAY_PUBLIC_URL:-http://127.0.0.1:3000}\n      BOX_PLAYER_LOGIN_URL:',
                '      BOX_PLAY_PUBLIC_URL: ${BOX_PLAY_PUBLIC_URL:-http://127.0.0.1:3000}\n      BOX_PLAY_INTERNAL_URL: http://play:3000\n      BOX_PLAYER_LOGIN_URL:',
            )
            .replace(/^\s*BOX_DATA_STORAGE_NAMESPACE:.*\n/m, '')
            .replace(/^\s*BOX_GROUP_STORAGE_NAMESPACE:.*\n/m, '')
            .replaceAll(
                '    restart: unless-stopped\n',
                '    restart: unless-stopped\n    security_opt:\n      - no-new-privileges:true\n    cap_drop:\n      - ALL\n',
            )
            .replace(
                '\n  play:\n',
                `\n  play-storage-init:\n    platform: \${BOX_PLAY_PLATFORM:-${playImageConfig.platform}}\n    image: \${BOX_PLAY_IMAGE:-${playImageConfig.image}}\n    user: "0:0"\n    command:\n      - sh\n      - -c\n      - mkdir -p /app/storage/runtime-cache && chown -R 1000:1000 /app/storage\n    restart: "no"\n    network_mode: none\n    read_only: true\n    security_opt:\n      - no-new-privileges:true\n    cap_drop:\n      - ALL\n    cap_add:\n      - CHOWN\n    volumes:\n      - type: bind\n        source: ./storage\n        target: /app/storage\n        bind:\n          create_host_path: true\n\n  play:\n`,
            )
            .replace(
                '      player-service:\n        condition: service_healthy\n',
                '      player-service:\n        condition: service_healthy\n      play-storage-init:\n        condition: service_completed_successfully\n',
            )
            .replace(
                `      BOX_WORLD_ID: ${manifest.id}\n`,
                `      BOX_WORLD_ID: ${manifest.id}\n      BOX_WORLD_PERMANENT_MAP_ID: ${manifest.permanentMapId || manifest.id}\n`,
            )
            .replace(
                `      BOX_WORLD_GROUP_ID: ${groupStorageNamespace}\n`,
                `      BOX_WORLD_GROUP_ID: ${groupStorageNamespace}\n      BOX_WORLD_PERMANENT_GROUP_ID: ${groupStorageNamespace}\n`,
            )
            .replace(
                '      BOX_DATA_STORAGE_PATH: /app/storage\n',
                '      BOX_RUNTIME_CACHE_PATH: /app/storage/runtime-cache\n',
            );
        fs.writeFileSync(packagedComposePath, packagedCompose);
        const distributionEnvExample = path.join(repoRoot, 'distribution', 'play', '.env.example');
        fs.copyFileSync(distributionEnvExample, path.join(temporaryBundleRoot, '.env.example'));
        fs.writeFileSync(
            path.join(temporaryBundleRoot, 'README.md'),
            `# ${manifest.projectName} ${target.version}\n\n作者：${manifest.author || '未署名'}\n\n${manifest.description || '暂无作品简介。'}\n\n这是一个只读游玩发布包，不包含作品的 \`source/\` 工程目录、编辑器或创作管理器。镜像架构为 \`${playImageConfig.platform}\`。\n\n## 完整性校验\n\n部署前在 Linux 执行 \`sha256sum -c SHA256SUMS\`，macOS 执行 \`shasum -a 256 -c SHA256SUMS\`。\`BUILD-INFO.json\` 记录构建版本、源码修订和镜像；\`LICENSE.txt\` 与 \`THIRD-PARTY-NOTICES.json\` 记录许可和第三方依赖。\n\n## 部署\n\n1. 复制 \`.env.example\` 为 \`.env\`，至少设置 \`PERMISSION_TOKEN_SECRET\` 和 PostgreSQL 的 \`BOX_DATABASE_URL\`。\n2. 执行 \`docker load -i play-image.tar\` 加载游玩镜像。\n3. 另行加载独立分发的 \`player-service-image.tar\`；玩家服务更新不需要重新导出本作品。\n4. 执行 \`docker compose up -d\`。\n5. 玩家打开 \`http://服务器地址:3000/\`，玩家中心默认位于 \`http://服务器地址:3213/\`。\n\n如需修改端口，可在同一个 \`.env\` 中填写 \`BOX_PLAY_PORT\` 和 \`BOX_PLAYER_SERVICE_PORT\`。玩家身份由独立玩家服务统一存入 PostgreSQL 的 \`box_identity\` schema；地图脚本数据存入 \`box_engine\` schema，数据库凭据只会传入服务端容器。\n\n\`getDataStorage\` 按地图隔离；\`getGroupStorage\` 默认使用地图组 ID，仅在同一主图/副图组内共享。不要把 \`BOX_GROUP_STORAGE_NAMESPACE\` 手动设成 \`global\`。\n\n\`world/\` 是 ${target.version} 的不可变世界快照，并以只读方式挂载，不能被 Local Engine 直接当作可编辑工程导入。可信服主仍可读取运行所需的世界数据，因此不要把未发布素材或真正的服务器秘密放进作品资源。\n`,
        );
        generateDistributionMetadata(temporaryBundleRoot, {
            repoRoot,
            generatedAt,
            imageTag: playImageConfig.tag,
            platform: playImageConfig.platform,
            release: {
                project: target.id,
                version: target.version,
                permissionHash: manifest.permissionHash,
                mapGroupId: manifest.mapGroupId || manifest.id,
            },
            images: {
                play: playImageConfig.image,
                playerService: playImageConfig.playerServiceImage,
            },
        });
        fs.renameSync(temporaryBundleRoot, bundleRoot);
    } catch (error) {
        fs.rmSync(temporaryBundleRoot, { recursive: true, force: true });
        throw error;
    }
    return {
        directory: bundleRoot,
        project: target.id,
        version: target.version,
        includesDockerImages: !!options.includeImages,
        image: playImageConfig.image,
        playerServiceImage: playImageConfig.playerServiceImage,
        platform: playImageConfig.platform,
    };
}

module.exports = {
    createProject,
    deleteProject,
    exportProject,
    createProjectBackup,
    getBackupConfiguration,
    listProjectBackups,
    resolveProjectBackup,
    pruneProjectBackups,
    readBackupStatus,
    runProjectBackups,
    exportPlayBundle,
    getAssetDistributionConfiguration: () => readAssetDistributionConfiguration(projectsRoot),
    saveAssetDistributionConfiguration: (configuration) =>
        saveAssetDistributionConfiguration(projectsRoot, configuration),
    getLaunchTarget,
    getProject,
    resolveProjectReference,
    projectStorageIdentity,
    mapGroupIdentity,
    mapGroupPaths: (id) => mapGroupManager.paths(id),
    materializeMapGroupState: (id) => mapGroupManager.materialize(id),
    listMapGroup,
    createSubmap,
    listProjects,
    importProject,
    createProjectSnapshot,
    listProjectSnapshots,
    restoreProjectSnapshot,
    restoreLatestProjectSnapshot,
    validateProjectSource,
    archiveEntriesAreSafe,
    normalizeImportedProjectPermissions,
    removeDirectoryWithRetry,
    packageProject,
    projectsRoot,
    publishProject,
    publishMapGroup,
    updateProject,
    updateProjectMapSize,
    updateProjectScript,
    readProjectScript,
    listProjectSharedScripts,
    selectCreatorModelAssets,
    selectCreatorAssetIndex,
    selectCreatorUiTree,
    getProjectResources,
};

if (require.main === module) {
    const [command, ...args] = process.argv.slice(2);
    try {
        if (command === 'list') {
            console.table(listProjects());
        } else if (command === 'create') {
            const [id, ...name] = args;
            console.log(JSON.stringify(createProject({ id, name: name.join(' ') || id }), null, 2));
        } else if (command === 'publish') {
            const [id, version] = args;
            console.log(JSON.stringify(publishProject(id, version), null, 2));
        } else if (command === 'package') {
            const includeImages = !args.includes('--no-image');
            const [reference, outputDirectory] = args.filter((arg) => arg !== '--no-image');
            console.log(
                JSON.stringify(
                    packageProject(reference, outputDirectory, { includeImages }),
                    null,
                    2,
                ),
            );
        } else {
            throw new Error('Usage: project-manager.js <list|create|publish|package> [arguments]');
        }
    } catch (error) {
        console.error(`Project command failed: ${error.message}`);
        process.exitCode = 1;
    }
}

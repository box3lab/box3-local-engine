import { z } from 'zod';

import {
  PLAYER_ADMIN_GRANTABLE_CAPABILITIES,
  type PlayerAdminRequirement,
} from '@box/player-policy';
import { CREATOR_CLI_CAPABILITIES } from '../shared/creator-cli-policy';
import { CREATOR_CAPABILITIES } from '../shared/creator-policy';
import { PlayerAdminRequestError } from './player-admin-errors';

const subjectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{32}$/i, '玩家身份无效');
const uuidSchema = z
  .string()
  .uuid('ID 无效');
const sessionIdSchema = z
  .string()
  .regex(/^[0-9a-f]{16}$/i, '会话标识无效');
const banIdSchema = z.coerce
  .string()
  .regex(/^\d+$/, '封禁记录无效');
const displayNameSchema = z
  .string()
  .trim()
  .min(1, '昵称长度必须为 1 到 32 个字符')
  .max(32, '昵称长度必须为 1 到 32 个字符');
const adminDisplayNameSchema = z
  .string()
  .trim()
  .min(1, '管理员昵称长度必须为 1 到 32 个字符')
  .max(32, '管理员昵称长度必须为 1 到 32 个字符');
const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]{2,31}$/, '管理员用户名必须以字母开头，只能包含字母、数字和下划线，长度为 3 到 32 个字符');
const playerUsernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]{2,31}$/, '用户名必须以字母开头，只能包含字母、数字和下划线，长度为 3 到 32 位');
const playerPasswordSchema = z
  .string()
  .min(10, '新密码长度必须为 10 到 128 个字符')
  .max(128, '新密码长度必须为 10 到 128 个字符');
const adminPasswordSchema = z
  .string()
  .min(12, '管理员密码长度必须为 12 到 128 个字符')
  .max(128, '管理员密码长度必须为 12 到 128 个字符');
const optionalFutureDateSchema = z
  .union([z.string(), z.null()])
  .transform((value, context) => {
    if (value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      context.addIssue({
        code: 'custom',
        message: '封禁截止时间必须晚于当前时间',
      });
      return z.NEVER;
    }
    return date.toISOString();
  });
const tagsSchema = z
  .array(z.string().trim().min(1).max(32, '每个标签不能超过 32 个字符'))
  .max(20, '最多设置 20 个标签，每个不超过 32 个字符')
  .transform((tags) => [...new Set(tags)]);
const boxIdSchema = z
  .string()
  .trim()
  .max(64, '神岛 ID 不能超过 64 个字符或包含控制字符')
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), {
    message: '神岛 ID 不能超过 64 个字符或包含控制字符',
  });
const userKeySchema = z
  .string()
  .trim()
  .max(128, '用户 Key 不能超过 128 个字符')
  .refine((value) => /^[\x20-\x7e]*$/.test(value), {
    message: '用户 Key 只能包含可打印 ASCII 字符',
  });
const reasonSchema = z
  .string()
  .trim()
  .max(500, '封禁原因不能超过 500 个字符');
const permissionSchema = z.enum(
  [...PLAYER_ADMIN_GRANTABLE_CAPABILITIES] as [
    (typeof PLAYER_ADMIN_GRANTABLE_CAPABILITIES)[number],
    ...(typeof PLAYER_ADMIN_GRANTABLE_CAPABILITIES)[number][],
  ],
);
const permissionsSchema = z
  .array(permissionSchema)
  .max(PLAYER_ADMIN_GRANTABLE_CAPABILITIES.length)
  .transform((permissions) => [...new Set(permissions)]);
const creatorPermissionsSchema = z
  .array(z.enum([...CREATOR_CAPABILITIES] as [
    (typeof CREATOR_CAPABILITIES)[number],
    ...(typeof CREATOR_CAPABILITIES)[number][],
  ]))
  .max(CREATOR_CAPABILITIES.length)
  .transform((permissions) => [...new Set(permissions)]);
const creatorCliPermissionsSchema = z
  .array(z.enum([...CREATOR_CLI_CAPABILITIES] as [
    (typeof CREATOR_CLI_CAPABILITIES)[number],
    ...(typeof CREATOR_CLI_CAPABILITIES)[number][],
  ]))
  // Normalize duplicates before the stored-scope limit is meaningful. Keeping
  // this small input cap also prevents a needlessly large admin request.
  .max(32)
  .transform((permissions) => [...new Set(permissions)]);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  if (issue?.code === 'unrecognized_keys') {
    throw new PlayerAdminRequestError('请求包含不支持的字段');
  }
  throw new PlayerAdminRequestError(
    issue?.message || '请求内容无效',
  );
}

function requestBody(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function rejectRemovedPlayerFields(body: Record<string, unknown>) {
  if ('role' in body || 'adminPermissions' in body) {
    throw new PlayerAdminRequestError('玩家账号不能授予后台权限');
  }
  if ('avatar' in body) {
    throw new PlayerAdminRequestError('玩家头像上传功能已停用');
  }
}

const playerPatchSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    adminNote: z.string().trim().max(2000, '服主备注不能超过 2000 个字符').optional(),
    tags: tagsSchema.optional(),
    boxId: boxIdSchema.optional(),
    userKey: userKeySchema.optional(),
    status: z.enum(['active', 'banned']).optional(),
    banReason: reasonSchema.optional(),
    bannedUntil: optionalFutureDateSchema.optional(),
    creatorAccess: z.boolean().optional(),
    creatorPermissions: creatorPermissionsSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, '没有可更新的玩家字段');

const playerCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create-cli-token'), name: z.string().trim().min(1, 'Token 名称不能为空').max(80, 'Token 名称不能超过 80 个字符'), scopes: creatorCliPermissionsSchema }).strict(),
  z.object({ action: z.literal('update-cli-token'), tokenId: z.string().regex(/^[a-z0-9]{12,32}$/i, 'CLI Token 标识无效'), scopes: creatorCliPermissionsSchema }).strict(),
  z.object({ action: z.literal('revoke-cli-token'), tokenId: z.string().regex(/^[a-z0-9]{12,32}$/i, 'CLI Token 标识无效') }).strict(),
  z.object({ action: z.literal('revoke-sessions') }).strict(),
  z.object({ action: z.literal('revoke-session'), sessionId: sessionIdSchema }).strict(),
  z.object({ action: z.literal('reset-password'), password: playerPasswordSchema }).strict(),
  z.object({
    action: z.enum(['ban-ip', 'ban-device']),
    value: z.string().trim().min(1, '封禁对象不能为空').max(128, '封禁对象无效'),
    reason: reasonSchema.optional().default(''),
    bannedUntil: optionalFutureDateSchema.optional().default(null),
  }).strict(),
  z.object({ action: z.literal('unban-source'), banId: banIdSchema }).strict(),
]);

export type PlayerItemOperation =
  | { kind: 'get'; subjectId: string }
  | { kind: 'patch'; subjectId: string; changes: z.infer<typeof playerPatchSchema> }
  | { kind: 'command'; subjectId: string; command: z.infer<typeof playerCommandSchema> }
  | { kind: 'delete'; subjectId: string };

export function playerItemRequirement(
  method: string | undefined,
  bodyValue: unknown,
): PlayerAdminRequirement | PlayerAdminRequirement[] {
  const body = requestBody(bodyValue);
  if (method === 'GET') return 'players.view';
  if (method === 'DELETE') return 'players.delete';
  if (method === 'PATCH') {
    const requirements: PlayerAdminRequirement[] = [];
    if (['status', 'banReason', 'bannedUntil'].some((field) => field in body)) {
      requirements.push('players.ban');
    }
    if (['displayName', 'adminNote', 'tags', 'boxId', 'userKey'].some((field) => field in body)) {
      requirements.push('players.manage');
    }
    if (['creatorAccess', 'creatorPermissions'].some((field) => field in body)) {
      requirements.push('creator-access.manage');
    }
    return requirements.length ? requirements : 'players.manage';
  }
  if (body.action === 'reset-password') return 'passwords.reset';
  if (body.action === 'revoke-sessions' || body.action === 'revoke-session') {
    return 'sessions.manage';
  }
  if (body.action === 'ban-ip' || body.action === 'ban-device' || body.action === 'unban-source') {
    return 'identity-bans.manage';
  }
  if (['create-cli-token', 'update-cli-token', 'revoke-cli-token'].includes(String(body.action))) {
    return 'creator-tokens.manage';
  }
  return 'players.manage';
}

export function parsePlayerItemOperation(
  method: string | undefined,
  subjectIdValue: unknown,
  bodyValue: unknown,
): PlayerItemOperation {
  const subjectId = parse(subjectIdSchema, String(subjectIdValue || ''));
  if (method === 'GET') return { kind: 'get', subjectId };
  if (method === 'DELETE') return { kind: 'delete', subjectId };
  const body = requestBody(bodyValue);
  rejectRemovedPlayerFields(body);
  if (method === 'PATCH') {
    return { kind: 'patch', subjectId, changes: parse(playerPatchSchema, body) };
  }
  return { kind: 'command', subjectId, command: parse(playerCommandSchema, body) };
}

const batchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('revoke-sessions'), subjectIds: z.array(subjectIdSchema).min(1).max(100) }).strict(),
  z.object({
    action: z.literal('ban'),
    subjectIds: z.array(subjectIdSchema).min(1).max(100),
    reason: reasonSchema.optional().default(''),
    bannedUntil: optionalFutureDateSchema.optional().default(null),
  }).strict(),
  z.object({ action: z.literal('unban'), subjectIds: z.array(subjectIdSchema).min(1).max(100) }).strict(),
  z.object({
    action: z.enum(['add-tag', 'remove-tag']),
    subjectIds: z.array(subjectIdSchema).min(1).max(100),
    tag: z.string().trim().min(1, '标签长度必须为 1 到 32 个字符').max(32, '标签长度必须为 1 到 32 个字符'),
  }).strict(),
]);

export function parsePlayerBatch(value: unknown) {
  const parsed = parse(batchSchema, requestBody(value));
  return { ...parsed, subjectIds: [...new Set(parsed.subjectIds)] };
}

export function playerBatchRequirement(value: unknown): PlayerAdminRequirement {
  const action = requestBody(value).action;
  if (action === 'revoke-sessions') return 'sessions.manage';
  if (action === 'ban' || action === 'unban') return 'players.ban';
  return 'players.manage';
}

const createAdminAccountSchema = z.object({
  username: usernameSchema,
  displayName: adminDisplayNameSchema,
  password: adminPasswordSchema,
  permissionGroupId: uuidSchema,
}).strict();

const updateAdminAccountSchema = z.object({
  displayName: adminDisplayNameSchema.optional(),
  password: adminPasswordSchema.optional(),
  permissionGroupId: uuidSchema.nullable().optional(),
  status: z.enum(['active', 'disabled']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, '没有可更新的管理账号字段');

export function parseCreateAdminAccount(value: unknown) {
  return parse(createAdminAccountSchema, requestBody(value));
}

export function parseUpdateAdminAccount(value: unknown) {
  return parse(updateAdminAccountSchema, requestBody(value));
}

const changeOwnAdminPasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码').max(128, '当前密码无效'),
  newPassword: adminPasswordSchema,
}).strict();

export function parseChangeOwnAdminPassword(value: unknown) {
  return parse(changeOwnAdminPasswordSchema, requestBody(value));
}

const permissionGroupSchema = z.object({
  name: z.string().trim().min(1, '权限组名称长度必须为 1 到 32 个字符').max(32, '权限组名称长度必须为 1 到 32 个字符'),
  permissions: permissionsSchema,
}).strict();

const permissionGroupPatchSchema = permissionGroupSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  '没有可更新的权限组字段',
);

export function parseCreatePermissionGroup(value: unknown) {
  return parse(permissionGroupSchema, requestBody(value));
}

export function parseUpdatePermissionGroup(value: unknown) {
  return parse(permissionGroupPatchSchema, requestBody(value));
}

export function parseUuid(value: unknown, label: string) {
  try {
    return parse(uuidSchema, String(value || ''));
  } catch {
    throw new PlayerAdminRequestError(`${label}无效`);
  }
}

export function parseMaintenanceAction(value: unknown) {
  return parse(
    z.object({ action: z.literal('cleanup-expired-sessions') }).strict(),
    requestBody(value),
  );
}

const createManagedPlayerSchema = z.object({
  username: playerUsernameSchema,
  displayName: displayNameSchema,
  password: z.string().min(10, '密码长度必须为 10 到 128 个字符').max(128, '密码长度必须为 10 到 128 个字符'),
  boxId: boxIdSchema.optional().default(''),
  userKey: userKeySchema.optional().default(''),
  tags: tagsSchema.optional().default([]),
  adminNote: z.string().trim().max(2000, '服主备注不能超过 2000 个字符').optional().default(''),
}).strict();

export function parseCreateManagedPlayer(value: unknown) {
  const body = requestBody(value);
  rejectRemovedPlayerFields(body);
  return parse(createManagedPlayerSchema, body);
}

function queryObject(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      Array.isArray(entry) ? entry[0] : entry,
    ]),
  );
}

const playerListQuerySchema = z.object({
  search: z.string().trim().max(64).optional().default(''),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(30),
  identity: z.enum(['all', 'user', 'box', 'banned']).catch('all'),
  online: z.enum(['all', 'online', 'offline']).catch('all'),
  sort: z.enum(['lastSeen', 'registered', 'displayName', 'loginCount']).catch('lastSeen'),
}).passthrough();

export function parsePlayerListQuery(value: Record<string, unknown>) {
  const result = parse(playerListQuerySchema, queryObject(value));
  return {
    search: result.search,
    page: result.page,
    pageSize: result.pageSize,
    identity: result.identity,
    role: 'player' as const,
    online: result.online,
    sort: result.sort,
  };
}

const activityQuerySchema = z.object({
  kind: z.enum(['all', 'login', 'admin']).catch('all'),
  search: z.string().trim().max(64).optional().default(''),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(30),
}).passthrough();

export function parsePlayerActivityQuery(value: Record<string, unknown>) {
  return parse(activityQuerySchema, queryObject(value));
}

const exportQuerySchema = playerListQuerySchema.omit({ page: true, pageSize: true }).extend({
  role: z.enum(['all', 'player', 'moderator', 'admin']).catch('all'),
});

export function parsePlayerExportQuery(value: Record<string, unknown>) {
  return parse(exportQuerySchema, queryObject(value));
}

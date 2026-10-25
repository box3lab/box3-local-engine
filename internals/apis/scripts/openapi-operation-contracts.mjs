const ref = (name) => ({ $ref: `#/components/schemas/${name}` })
const array = (name) => ({ type: 'array', items: ref(name) })
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  required,
  properties,
})

const loginNavigation = {
  source: { type: 'string', description: '返回的应用：play 或 creator。' },
  returnUrl: { type: 'string', description: '由服务端校验的应用返回地址。' },
  transferState: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$', description: '目标站点发起的浏览器登录校验状态。' },
  transferChallenge: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$', description: '目标站点持有的校验值对应的 SHA-256 挑战。' },
}
const portalSession = object({
  player: { oneOf: [ref('PlayerLauncherSessionPlayer'), { type: 'null' }] },
  registrationEnabled: { type: 'boolean' },
  returnUrl: { type: 'string', description: '后端生成的安全回跳地址；跨站时为带一次性登录码的应用回调。' },
}, ['player'])

const moderationRecord = object({
  id:{type:'string',format:'uuid'},kind:{type:'string',enum:['account','ip','device']},scope:{type:'string',enum:['map','server']},
  userId:{type:['string','null']},reason:{type:'string'},createdAt:{type:'string',format:'date-time'},
  expiresAt:{type:['string','null'],format:'date-time'},revokedAt:{type:['string','null'],format:'date-time'},
  status:{type:'string',enum:['active','expired','revoked']},remainingSeconds:{type:['integer','null'],minimum:0},
})

const contracts = {
  'post /api/player-auth/transfer': object({ code: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' } }),
  'post /api/player-internal/login-transfer': object({ session: { type: 'string' }, device: { type: 'string' } }),
  'post /api/player-internal/script-metadata':object({observed:{type:'boolean'}}),
  'post /api/player-internal/script-moderation': {oneOf:[
    object({ban:{anyOf:[moderationRecord,{type:'null'}]},replayed:{type:'boolean'}}),
    object({items:{type:'array',items:moderationRecord},total:{type:'integer'},page:{type:'integer'},pageSize:{type:'integer'},replayed:{type:'boolean'}}),
    object({id:{type:'string',format:'uuid'},scope:{type:'string',enum:['map','server']},expiresAt:{type:['string','null'],format:'date-time'},replayed:{type:'boolean'}}),
    object({id:{type:'string',format:'uuid'},revoked:{type:'boolean'},replayed:{type:'boolean'}}),
    object({status:{type:'string',enum:['active','banned']},replayed:{type:'boolean'},bans:{type:'array',items:object({id:{type:'string'},kind:{type:'string',enum:['account','ip','device']},scope:{type:'string',enum:['map','server']},reason:{type:'string'},expiresAt:{type:['string','null']}})}}),
  ]},
  'post /api/player-internal/map-admission': object({ allowed: { type: 'boolean' }, denied:{type:'array',items:{type:'integer'}} },[]),
  'get /api/play-admin/script-moderation': object({
    keys: { type:'array', items: object({id:{type:'string'},adminId:{type:['string','null']},adminName:{type:['string','null']},permissions:{type:['array','null'],items:{type:'string'}},name:{type:'string'},scope:{type:'string',enum:['map','server']},maximumBanSeconds:{anyOf:[{type:'integer',const:0},{type:'integer',minimum:60,maximum:604800}]},expiresAt:{type:'string'},revokedAt:{type:['string','null']}}) },
    maps:{type:'array',items:object({mapId:{type:'string'},groupId:{type:'string'},name:{type:'string'},projectId:{type:'string'},publicId:{type:'string'},description:{type:'string'},version:{type:'string'},mode:{type:'string',enum:['edit','play']},observedAt:{type:'string'}})},
    bindings: { type:'array', items: object({mapId:{type:'string'},mode:{type:'string',enum:['edit','play']},keyId:{type:'string'}}) },
    bans:{type:'array',items:object({id:{type:'string'},mapId:{type:'string'},subjectId:{type:'string'},kind:{type:'string'},reason:{type:'string'},expiresAt:{type:['string','null']}})},
  }),
  'patch /api/auth/profile': object({ player: ref('PlayerSelfProfile') }),
  'patch /api/player-auth/profile': object({ player: ref('PlayerSelfProfile') }),
  'post /api/auth/password': object({ changed: { type: 'boolean', const: true }, reloginRequired: { type: 'boolean', const: true } }),
  'post /api/player-auth/password': object({ changed: { type: 'boolean', const: true }, reloginRequired: { type: 'boolean', const: true } }),
  'get /api/health-check': object({ status: { type: 'string' }, runtime: { type: 'string' } }, ['status']),
  'get /api/player-launcher/bootstrap': ref('PlayerLauncherBootstrap'),
  'get /api/player-launcher/maps': object({ worlds: array('PlayerLauncherWorld') }),
  'get /api/player-launcher/maps/{mapId}/descriptor': ref('PlayerLauncherPackageDescriptor'),
  'get /api/player-launcher/maps/{mapId}/download-plan': ref('PlayerLauncherDownloadPlan'),
  'post /api/auth/login': portalSession,
  'post /api/auth/register': portalSession,
  'get /api/auth/session': portalSession,
  'post /api/player-auth/register': object({ player: ref('PlayerLauncherSessionPlayer') }),
  'post /api/auth/logout': object({ loggedOut: { type: 'boolean' } }),
  'patch /api/play-profile': object({ player: ref('PlayerLauncherSessionPlayer') }),
  'get /api/play-library': object({
    player: ref('PlayerLauncherSessionPlayer'),
    entries: array('PlayerMapLibraryEntry'),
    libraryEnabled: { type: 'boolean' },
  }),
  'get /api/play-admin/activity': object({
    events: array('PlayerAdminActivity'),
    total: { type: 'integer' },
  }),
  'get /api/play-admin/admins': object({ admins: array('PlayerAdminAccount') }),
  'get /api/play-admin/container-resource-groups': object({
    resourceGroups: array('ContainerResourceGroup'),
  }),
  'get /api/play-admin/containers': ref('ContainerCatalog'),
  'get /api/play-admin/identity-bans': object({
    bans: array('IdentityBan'),
    total: { type: 'integer' },
  }),
  'get /api/play-admin/permission-groups': object({ groups: array('PermissionGroup') }),
  'get /api/play-admin/players': object({
    players: array('Player'),
    total: { type: 'integer' },
  }),
  'post /api/play-admin/players': object({ player: ref('Player') }),
  'get /api/play-admin/players/overview': object({
    totals: { type: 'object', additionalProperties: { type: 'number' } },
  }),
  'post /api/play-admin/login': object({ actor: ref('PlayerAdminActor') }),
  'post /api/play-admin/owner-session': object({ actor: ref('PlayerAdminActor') }),
  'get /api/play-admin/verify': object({ actor: ref('PlayerAdminActor') }),
}

const requestContracts = {
  'post /api/local-projects/{id}/runtime': object({
    mode: { type: 'string', enum: ['edit', 'play'] },
  }),
  'post /api/player-auth/transfer': object({ source: { type: 'string', enum: ['play', 'creator'] }, challenge: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' } }),
  'post /api/player-internal/login-transfer': object({ code: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' }, source: { type: 'string', enum: ['play', 'creator'] }, verifier: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' } }),
  'post /api/player-internal/script-metadata':{...object({mapId:{type:'string'},groupId:{type:'string'},mode:{type:'string',enum:['edit','play']},name:{type:'string',minLength:1,maxLength:64},projectId:{type:'string'},publicId:{type:'string',maxLength:128},description:{type:'string',maxLength:2000},version:{type:'string',maxLength:64},},['mapId','mode','name']),additionalProperties:false},
  'post /api/player-internal/map-admission': {oneOf:[
    {...object({mapId:{type:'string'},userId:{type:'string'},ipAddress:{type:'string'},deviceHash:{type:'string',pattern:'^[0-9a-f]{64}$'}},['mapId','userId','ipAddress']),additionalProperties:false},
    {...object({mapId:{type:'string'},players:{type:'array',minItems:1,maxItems:100,items:object({userId:{type:'string'},ipAddress:{type:'string'},deviceHash:{type:'string',pattern:'^[0-9a-f]{64}$'}},['userId','ipAddress'])}}),additionalProperties:false},
  ]},
  'post /api/player-internal/script-moderation': {...object({
    mapId:{type:'string'},action:{type:'string',enum:['banPlayer','banCurrentIP','banCurrentDevice','revokeBan','getPlayerStatus','listBans','getBan']},
    userId:{type:'string'},ipAddress:{type:'string'},deviceHash:{type:'string',pattern:'^[0-9a-f]{64}$'},scope:{type:'string',enum:['map','server']},durationSeconds:{type:'integer',minimum:0,maximum:604800,description:'0 表示永久，需后台允许永久封禁'},reason:{type:'string'},banId:{type:'string'},requestId:{type:'string'},kind:{type:'string',enum:['account','ip','device']},status:{type:'string',enum:['active','expired','revoked','all']},page:{type:'integer',minimum:1,maximum:100000},pageSize:{type:'integer',minimum:1,maximum:50},
  },['mapId','action']),additionalProperties:false},
  'post /api/play-admin/script-moderation': {oneOf:[
    object({action:{type:'string',const:'create'},values:object({mapId:{type:'string'},mode:{type:'string',enum:['edit','play']},permissions:{type:'array',items:{type:'string',enum:['players.view','players.ban','identity-bans.manage','moderation.view']}},name:{type:'string'},scope:{type:'string',enum:['map','server']},maximumBanSeconds:{anyOf:[{type:'integer',const:0},{type:'integer',minimum:60,maximum:604800}]},expiresAt:{type:'string'}},['mapId'])}),
    object({action:{type:'string',const:'bind'},values:object({mapId:{type:'string'},mode:{type:'string',enum:['edit','play']},keyId:{type:'string'}})}),
    object({action:{type:'string',const:'update'},values:object({mapId:{type:'string'},mode:{type:'string',enum:['edit','play']},keyId:{type:'string'},permissions:{type:'array',minItems:1,maxItems:4,items:{type:'string',enum:['players.view','players.ban','identity-bans.manage','moderation.view']}},days:{type:'integer',minimum:1,maximum:360},maximumBanSeconds:{anyOf:[{type:'integer',const:0},{type:'integer',minimum:60,maximum:604800}]},scope:{type:'string',enum:['map','server']}},['mapId','keyId'])}),
    object({action:{type:'string',const:'revoke'},keyId:{type:'string'}}),
    object({action:{type:'string',const:'unbind'},mapId:{type:'string'},mode:{type:'string',enum:['edit','play']}},['action','mapId']),
    object({action:{type:'string',const:'revoke-map-ban'},banId:{type:'string'}}),
  ]},
  'patch /api/auth/profile': { ...object({ displayName: { type: 'string', minLength: 1, maxLength: 32 } }), additionalProperties: false },
  'patch /api/player-auth/profile': { ...object({ displayName: { type: 'string', minLength: 1, maxLength: 32 } }), additionalProperties: false },
  'post /api/auth/password': { ...object({
    currentPassword: { type: 'string', minLength: 1, maxLength: 128, writeOnly: true },
    newPassword: { type: 'string', minLength: 10, maxLength: 128, writeOnly: true },
  }), additionalProperties: false },
  'post /api/player-auth/password': { ...object({
    currentPassword: { type: 'string', minLength: 1, maxLength: 128, writeOnly: true },
    newPassword: { type: 'string', minLength: 10, maxLength: 128, writeOnly: true },
  }), additionalProperties: false },
  'patch /api/play-library': object({
    mapId: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$' },
    favorite: { type: 'boolean' },
    played: { type: 'boolean' },
  }, ['mapId']),
  'patch /api/play-profile': object({ displayName: { type: 'string' }, avatarSkinId: { type: 'string' } }, []),
  'post /api/auth/login': object({ username: { type: 'string' }, password: { type: 'string' }, ...loginNavigation }, ['username', 'password']),
  'post /api/auth/register': object({ username: { type: 'string' }, displayName: { type: 'string' }, password: { type: 'string' }, ...loginNavigation }, ['username', 'displayName', 'password']),
  'post /api/auth/logout': object({}),
  'post /api/player-auth/login': object({ username: { type: 'string' }, password: { type: 'string' } }),
  'post /api/player-auth/register': object({ username: { type: 'string' }, displayName: { type: 'string' }, password: { type: 'string' } }),
  'post /api/player-auth/logout': object({}),
  'post /api/play-admin/login': object({ username: { type: 'string' }, password: { type: 'string' } }),
  'post /api/play-admin/admins': object({
    username: { type: 'string' },
    displayName: { type: 'string' },
    password: { type: 'string' },
    permissionGroupId: { type: 'string' },
  }, ['username', 'displayName', 'password', 'permissionGroupId']),
  'patch /api/play-admin/admins/{id}': object({
    displayName: { type: 'string' }, password: { type: 'string' }, permissionGroupId: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['active', 'disabled'] },
  }, []),
  'post /api/play-admin/permission-groups': object({
    name: { type: 'string' },
    permissions: { type: 'array', items: { type: 'string' } },
  }),
  'post /api/play-admin/container-resource-groups': ref('ContainerResourceGroup'),
  'patch /api/play-admin/container-resource-groups/{id}': ref('ContainerResourceGroup'),
  // This endpoint accepts either a raw .boxplay archive or a JSON confirm command.
  'post /api/play-admin/library/import': {},
}

export function applyOperationContracts(paths) {
  const portalSessionOperation = paths['/api/auth/session']?.get
  if (portalSessionOperation) {
    portalSessionOperation.parameters = [
      ...(portalSessionOperation.parameters || []).filter(parameter => !Object.hasOwn(loginNavigation, parameter.name)),
      ...Object.entries(loginNavigation).map(([name, schema]) => ({ name, in: 'query', required: false, description: schema.description, schema })),
    ]
  }
  for (const [path, status] of [['/api/player-login/start', 302], ['/api/player-login/callback', 303]]) {
    const operation = paths[path]?.get
    if (!operation) continue
    delete operation.responses[200]
    operation.responses[status] = { description: '浏览器顶层跳转；响应设置 HttpOnly Cookie，禁止缓存。', headers: { Location: { schema: { type: 'string', format: 'uri' } } } }
    if (path.endsWith('/callback')) operation.parameters = ['code', 'state'].map(name => ({ name, description: name === 'code' ? '60 秒内有效的一次性登录码。' : '发起站点设置的浏览器校验状态。', in: 'query', required: true, schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' } }))
  }
  for (const apiPath of ['/api/auth/profile', '/api/player-auth/profile', '/api/auth/password', '/api/player-auth/password']) {
    const password = apiPath.endsWith('/password')
    const operation = paths[apiPath]?.[password ? 'post' : 'patch']
    if (!operation) continue
    operation.description = password
      ? '仅修改当前登录玩家的密码，必须验证原密码。成功后撤销该玩家全部会话并清除当前会话 Cookie，需要重新登录；正在游玩的会话也会收到撤销通知。'
      : '仅修改当前登录玩家的昵称；不接受身份 ID、角色、头像或权限字段。'
    for (const [status, description] of Object.entries({ 400: '字段无效，或原密码不正确。', 401: '缺少有效会话或服务端凭据。', 403: '账号或访问来源被封禁。', 429: '操作过于频繁；按 Retry-After 重试。', 503: '账号服务暂时不可用。' })) {
      operation.responses[status] = { description, content: { 'application/json': { schema: ref('ApiError') } } }
    }
    operation.responses[429].headers = { 'Retry-After': { description: '建议等待的秒数。', schema: { type: 'integer', minimum: 1 } } }
  }
  for (const [key, schema] of Object.entries(contracts)) {
    const [method, apiPath] = key.split(' ')
    const operation = paths[apiPath]?.[method]
    if (!operation) continue
    operation.responses[200].content['application/json'].schema = schema
  }
  for (const apiPath of ['/api/auth/register', '/api/player-auth/register']) {
    const operation = paths[apiPath]?.post
    if (!operation) continue
    operation.responses[201] = { ...operation.responses[200], description: '玩家账号已创建并登录。' }
    delete operation.responses[200]
  }
  for (const [key, schema] of Object.entries(requestContracts)) {
    const [method, apiPath] = key.split(' ')
    const operation = paths[apiPath]?.[method]
    if (!operation) continue
    operation.requestBody = {
      required: true,
      content: { 'application/json': { schema } },
    }
  }
  const moderation = paths['/api/player-internal/script-moderation']?.post
  if (moderation) {
    for (const code of [400, 401, 403, 404, 405, 409, 429, 503]) {
      moderation.responses[code] = {
        description: '地图脚本管理错误，遵循 CommonError。',
        content: { 'application/json': { schema: object({
          status: { type: 'string', enum: ['MODERATION_PARAMS_INVALID', 'MODERATION_AUTH_REQUIRED', 'MODERATION_FORBIDDEN', 'MODERATION_NOT_FOUND', 'MODERATION_CONFLICT', 'MODERATION_RATE_LIMITED', 'MODERATION_UNAVAILABLE'] },
          code: { type: 'integer' }, msg: { type: 'string' },
        }) } },
      }
    }
    moderation.responses[429].headers = { 'Retry-After': { description: '建议等待的秒数。', schema: { type: 'integer', minimum: 1 } } }
  }
  const publicModels = paths['/api/play-models']?.get
  if (publicModels)
    publicModels.responses[200].content['application/json'].schema = object({
      models: array('PlayModel'),
    })
  const previewData = paths['/api/play-models/{id}']?.get
  if (previewData) {
    previewData.responses[200].content = {
      'application/vnd.box.voxaplay+json': { schema: { type: 'string', format: 'binary' } },
    }
    previewData.responses[404] = { description: '模型预览不存在或尚未发布。' }
  }
  const models = paths['/api/play-admin/models']
  if (models?.get)
    models.get.responses[200].content['application/json'].schema = object({
      models: array('PlayModel'),
    })
  if (models?.post) {
    models.post.requestBody = {
      required: true,
      content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
    }
    models.post.responses[201] = {
      description: '模型预览包已上传并发布。',
      content: { 'application/json': { schema: object({ model: ref('PlayModel') }) } },
    }
    delete models.post.responses[200]
  }
  const model = paths['/api/play-admin/models/{id}']
  if (model?.patch) {
    model.patch.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              author: { type: 'string', maxLength: 100 },
              version: { type: 'string', minLength: 1, maxLength: 50 },
              description: { type: 'string', maxLength: 2000 },
              published: { type: 'boolean' },
            },
          },
        },
      },
    }
    model.patch.responses[200].content['application/json'].schema = object({
      model: ref('PlayModel'),
    })
  }
  if (model?.delete) {
    delete model.delete.responses[200]
    model.delete.responses[204] = { description: '模型预览已删除。' }
  }
  const libraryUpdate = paths['/api/play-library']?.patch
  if (libraryUpdate) {
    delete libraryUpdate.responses[200]
    libraryUpdate.responses[204] = { description: '玩家收藏或最近游玩记录已更新。' }
  }
  const blobDownload = paths['/api/player-launcher/maps/{mapId}/blobs/{hash}']?.get
  if (blobDownload?.responses?.['200']) {
    blobDownload.parameters = [
      ...(blobDownload.parameters || []),
      {
        name: 'Range',
        in: 'header',
        required: false,
        description: '续传公开地图资源时使用的字节起始偏移。',
        schema: { type: 'string', pattern: '^bytes=[0-9]+-$' },
      },
    ]
    blobDownload.responses['200'].content = {
      'application/octet-stream': { schema: { type: 'string', format: 'binary' } },
    }
  }
}

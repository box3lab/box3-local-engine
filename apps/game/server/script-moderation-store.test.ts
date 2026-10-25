import { expect, test } from '@jest/globals'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ScriptModerationStore, keyCreateSchema } from './script-moderation-store'
import { moderationBanExpiry, moderationCommandSchema } from './script-moderation-service'

test('permanent bans require explicit permanent authorization', () => {
  expect(keyCreateSchema.parse({ mapId: 'main-map' }).scope).toBe('server')
  expect(keyCreateSchema.parse({ mapId: 'main-map', scope: 'map' }).scope).toBe('server')
  expect(moderationCommandSchema.parse({ mapId: 'main-map', action: 'banPlayer' }).scope).toBe(
    'server',
  )
  expect(keyCreateSchema.parse({ mapId: 'main-map', maximumBanSeconds: 0 }).maximumBanSeconds).toBe(
    0,
  )
  expect(
    moderationCommandSchema.parse({ mapId: 'main-map', action: 'banPlayer', durationSeconds: 0 })
      .durationSeconds,
  ).toBe(0)
  expect(moderationBanExpiry(0, 0)).toBeNull()
  expect(moderationBanExpiry(120, 0)).toBeInstanceOf(Date)
  expect(() => moderationBanExpiry(0, 3600)).toThrow('不允许永久封禁')
  expect(() => moderationBanExpiry(3601, 3600)).toThrow('授权上限')
  expect(() => moderationBanExpiry(undefined, 0)).toThrow('durationSeconds')
})

// Uses a disposable schema and never touches deployment tables.
const integration = process.env.MODERATION_TEST_DATABASE_URL ? test : test.skip
integration(
  'first owner initializes identity storage before group grants, offline renewals and permanent bans',
  async () => {
    const pg = await import('pg')
    const { Pool } = pg
    const ownedPools: InstanceType<typeof Pool>[] = []
    const poolConstructor = jest.spyOn(pg, 'Pool').mockImplementation((options) => {
      const instance = new pg.Pool(options)
      ownedPools.push(instance)
      return instance
    })
    const { ScriptModerationService } = await import('./script-moderation-service')
    const pool = new Pool({ connectionString: process.env.MODERATION_TEST_DATABASE_URL })
    const schema = `moderation_test_${Date.now()}`
    const table = (name: string) => `"${schema}"."${name}"`
    const store = new ScriptModerationStore()
    const projects = await fs.mkdtemp(path.join(os.tmpdir(), 'moderation-map-names-'))
    const environmentKeys = [
      'BOX_CREATOR_PROJECTS_PATH',
      'BOX_DATABASE_URL',
      'BOX_IDENTITY_DATABASE_SCHEMA',
      'PERMISSION_TOKEN_SECRET',
      'BOX_DATABASE_SSL',
      'BOX_PLAY_ADMIN_TOKEN',
    ] as const
    const previousEnvironment = Object.fromEntries(
      environmentKeys.map((key) => [key, process.env[key]]),
    )
    process.env.BOX_CREATOR_PROJECTS_PATH = projects
    process.env.BOX_DATABASE_URL = process.env.MODERATION_TEST_DATABASE_URL
    process.env.BOX_IDENTITY_DATABASE_SCHEMA = schema
    process.env.PERMISSION_TOKEN_SECRET = 'fixture-moderation-secret-000000000000'
    process.env.BOX_DATABASE_SSL = 'false'
    process.env.BOX_PLAY_ADMIN_TOKEN = ''
    await fs.mkdir(path.join(projects, 'main-map-project'))
    await fs.writeFile(
      path.join(projects, 'main-map-project', 'project.json'),
      JSON.stringify({ name: '真正的地图名称', permanentMapId: 'main-map' }),
    )
    try {
      await pool.query(`CREATE SCHEMA "${schema}"`)
      expect(
        (await pool.query('SELECT to_regclass($1) AS relation', [`${schema}.identity_bans`]))
          .rows[0].relation,
      ).toBeNull()

      // Exercise the public cold-start path before any player registers or logs in.
      await store.ready()
      expect(
        (await pool.query(`SELECT COUNT(*)::integer AS total FROM ${table('users')}`)).rows[0]
          .total,
      ).toBe(0)
      expect(
        (await pool.query('SELECT to_regclass($1) AS relation', [`${schema}.identity_bans`]))
          .rows[0].relation,
      ).not.toBeNull()
      for (const mode of ['edit', 'play']) {
        for (const mapId of ['main-map', 'sub-map']) {
          await store.observeRuntime({
            mapId,
            mode,
            groupId: 'main-map',
            name: mode === 'edit' && mapId === 'main-map' ? '256x64x256' : mapId,
            projectId: mode === 'edit' ? undefined : `${mapId}-project`,
            publicId: `${mapId}-access`,
            version: 'v1',
          })
        }
      }
      const edit = await store.create(
        { mapId: 'main-map', mode: 'edit', permissions: ['players.view', 'players.ban'] },
        'owner',
        {
          ip: '192.0.2.10',
          userAgent: 'audit regression',
          deviceHash: '',
          actorDisplayName: '测试服主',
        },
      )
      await expect(
        store.create(
          { mapId: 'main-map', expiresAt: new Date(Date.now() + 361 * 86400000).toISOString() },
          'owner',
        ),
      ).rejects.toThrow('360 天')
      const creationAudit = (
        await pool.query(
          `SELECT details,ip_address FROM ${table('admin_audit_events')} WHERE target_id=$1`,
          [edit.id],
        )
      ).rows[0]
      expect(creationAudit.ip_address).toBe('192.0.2.10')
      expect(creationAudit.details).toMatchObject({
        mapId: 'main-map',
        mapName: '真正的地图名称',
        targetType: 'map-group',
        actorDisplayName: '测试服主',
      })
      const play = await store.create(
        {
          mapId: 'main-map',
          mode: 'play',
          permissions: ['players.ban'],
          maximumBanSeconds: 0,
          expiresAt: new Date(Date.now() + 360 * 86400000).toISOString(),
        },
        'owner',
      )
      const catalog = await store.list()
      expect(catalog.keys.find((key: any) => key.id === play.id).scope).toBe('server')
      expect(catalog.maps).toHaveLength(4)
      expect(
        catalog.maps.find((map: any) => map.mapId === 'main-map' && map.mode === 'edit'),
      ).toMatchObject({ name: '真正的地图名称', projectId: 'main-map' })
      expect(catalog.keys.find((key: any) => key.id === edit.id).name).toBe('真正的地图名称')
      expect(
        catalog.maps.find((map: any) => map.mapId === 'main-map' && map.mode === 'play').name,
      ).toBe('真正的地图名称')
      expect(
        catalog.maps.find((map: any) => map.mapId === 'main-map' && map.mode === 'play'),
      ).toMatchObject({ projectId: 'main-map', version: 'v1' })
      expect(catalog.bindings.filter((binding: any) => binding.keyId === edit.id)).toHaveLength(0)
      expect(catalog.bindings.filter((binding: any) => binding.keyId === play.id)).toHaveLength(1)
      const client = await pool.connect()
      try {
        const service = new ScriptModerationService() as any
        expect((await service.grant(client, table, { mapId: 'sub-map' }, false, 'edit')).id).toBe(
          play.id,
        )
        expect((await service.grant(client, table, { mapId: 'sub-map' }, false, 'play')).id).toBe(
          play.id,
        )
        await expect(
          service.grant(client, table, { mapId: 'other-map' }, false, 'play'),
        ).rejects.toThrow('地图未授权')
        await store.observeRuntime({
          mapId: 'sub-map',
          mode: 'edit',
          groupId: 'main-map',
          name: '已更新的脚本',
          version: 'v2',
        })
        expect((await service.grant(client, table, { mapId: 'sub-map' }, false, 'edit')).id).toBe(
          play.id,
        )
        await store.observeRuntime({
          mapId: 'new-sub-map',
          mode: 'play',
          groupId: 'main-map',
          name: '新副地图',
        })
        expect(
          (await service.grant(client, table, { mapId: 'new-sub-map' }, false, 'play')).id,
        ).toBe(play.id)
        await store.observeRuntime({
          mapId: 'edit-only-sub',
          mode: 'edit',
          groupId: 'main-map',
          name: '仅创作端已登记',
        })
        expect(
          (await service.grant(client, table, { mapId: 'edit-only-sub' }, false, 'play')).id,
        ).toBe(play.id)
        // Exercise actual map-ban persistence and revocation using a trusted resolved player.
        service.target = async () => ({
          principal_id: 'c87f7ea2-b599-4a68-94d9-385ea2955490',
          role: 'player',
          status: 'active',
        })
        const grant = await service.grant(client, table, { mapId: 'sub-map' }, false, 'play')
        const ban = await service.apply(
          client,
          table,
          {
            mapId: 'sub-map',
            scope: 'map',
            action: 'banPlayer',
            durationSeconds: 0,
            reason: '测试永久处罚',
          },
          grant,
          {},
        )
        expect(ban.expiresAt).toBeNull()
        const stored = (
          await pool.query(
            `SELECT expires_at,revoked_at FROM ${table('script_moderation_bans')} WHERE id=$1`,
            [ban.id],
          )
        ).rows[0]
        expect(stored.expires_at).toBeNull()
        expect(stored.revoked_at).toBeNull()
        expect((await store.list()).bans.some((row: any) => row.id === ban.id)).toBe(true)
        await service.revoke(
          client,
          table,
          { mapId: 'sub-map', banId: ban.id, action: 'revokeBan' },
          grant,
          {},
        )
        expect((await store.list()).bans.some((row: any) => row.id === ban.id)).toBe(false)
        await pool.query(
          `UPDATE ${table('script_runtime_metadata')} SET observed_at=NOW()-INTERVAL '1 day'`,
        )
        await store.updateAuthorization(
          {
            mapId: 'main-map',
            mode: 'edit',
            keyId: edit.id,
            days: 360,
            maximumBanSeconds: 0,
            scope: 'server',
          },
          'owner',
        )
        expect(
          (await service.grant(client, table, { mapId: 'sub-map' }, false, 'edit'))
            .maximum_ban_seconds,
        ).toBe(0)
        const renewed = (await store.list()).keys.find((key: any) => key.id === edit.id)
        expect(new Date(renewed.expiresAt).getTime()).toBeGreaterThan(Date.now() + 359 * 86400000)
        await expect(
          store.updateAuthorization(
            { mapId: 'main-map', mode: 'edit', keyId: edit.id, days: 361 },
            'owner',
          ),
        ).rejects.toThrow()
        await store.updateAuthorization(
          { mapId: 'main-map', mode: 'edit', keyId: edit.id },
          'owner',
        )
        expect((await store.list()).keys.find((key: any) => key.id === edit.id)).toMatchObject({
          maximumBanSeconds: 0,
          scope: 'server',
        })
        await store.revoke(edit.id, 'owner')
        await expect(
          service.grant(client, table, { mapId: 'sub-map' }, false, 'edit'),
        ).rejects.toMatchObject({ moderationStatus: 'MODERATION_GRANT_REVOKED', status: 403 })
        await expect(
          service.grant(client, table, { mapId: 'sub-map' }, false, 'play'),
        ).rejects.toMatchObject({ moderationStatus: 'MODERATION_GRANT_REVOKED', status: 403 })
      } finally {
        client.release()
      }
      // Upgrade an old deployment that had separate edit/play bindings.
      await pool.query(`DROP INDEX ${table('script_admin_bindings_map')}`)
      await pool.query(
        `CREATE UNIQUE INDEX script_admin_bindings_map_mode ON ${table('script_admin_bindings')}(map_id,mode)`,
      )
      await pool.query(
        `UPDATE ${table('script_admin_bindings')} SET mode='edit',updated_at=NOW()-INTERVAL '1 day'`,
      )
      await pool.query(
        `INSERT INTO ${table('script_admin_bindings')}(map_id,mode,key_id,updated_by) VALUES('main-map','play',$1,'owner')`,
        [play.id],
      )
      await (store as any).initialize({ pool, table })
      await pool.query(`UPDATE ${table('script_admin_keys')} SET scope='map' WHERE id=$1`, [
        play.id,
      ])
      await (store as any).initialize({ pool, table })
      const migrated = await store.list()
      expect(migrated.keys.find((key: any) => key.id === play.id).scope).toBe('server')
      expect(migrated.bindings).toHaveLength(1)
      expect(migrated.bindings[0].keyId).toBe(play.id)
      await (store as any).initialize({ pool, table })
      expect((await store.list()).bindings).toHaveLength(1)
      // Projects that have never started must be listed and authorizable directly.
      await fs.mkdir(path.join(projects, 'offline-main-project'))
      await fs.writeFile(
        path.join(projects, 'offline-main-project', 'project.json'),
        JSON.stringify({ name: '未启动的地图组', permanentMapId: 'offline-main' }),
      )
      await fs.mkdir(path.join(projects, 'offline-sub-project'))
      await fs.writeFile(
        path.join(projects, 'offline-sub-project', 'project.json'),
        JSON.stringify({
          name: '未启动的副地图',
          permanentMapId: 'offline-sub',
          mapRole: 'submap',
          mainProjectId: 'offline-main-project',
        }),
      )
      const offlineCatalog = await store.list()
      expect(offlineCatalog.maps.find((map: any) => map.mapId === 'offline-main')).toMatchObject({
        name: '未启动的地图组',
        groupId: 'offline-main',
      })
      expect(offlineCatalog.maps.find((map: any) => map.mapId === 'offline-sub')).toMatchObject({
        groupId: 'offline-main',
      })
      const offline = await store.create({ mapId: 'offline-sub' }, 'owner')
      expect(
        (await store.list()).bindings.find((binding: any) => binding.keyId === offline.id).mapId,
      ).toBe('offline-main')
      expect(
        (
          await pool.query(
            `SELECT COUNT(*)::integer AS total FROM ${table('script_runtime_metadata')} WHERE map_id IN ('offline-main','offline-sub')`,
          )
        ).rows[0].total,
      ).toBe(0)
    } finally {
      try {
        await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      } finally {
        try {
          await Promise.all([pool.end(), ...ownedPools.map((database) => database.end())])
        } finally {
          poolConstructor.mockRestore()
          for (const key of environmentKeys) {
            if (previousEnvironment[key] === undefined) delete process.env[key]
            else process.env[key] = previousEnvironment[key]
          }
          await fs.rm(projects, { recursive: true, force: true })
        }
      }
    }
  },
)

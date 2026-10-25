import type { NextApiRequest, NextApiResponse } from 'next'
import { afterAll, beforeEach, describe, expect, test } from '@jest/globals'

import { createPlayerLauncherBootstrapHandler } from '../pages/api/player-launcher/bootstrap'
import { createPlayerLauncherMapsHandler } from '../pages/api/player-launcher/maps'
import { createPlayerLauncherDescriptorHandler } from '../pages/api/player-launcher/maps/[mapId]/descriptor'
import { PlayerAuthenticationRequiredError } from './player-service-client'

function request(method = 'GET') {
  return {
    method,
    headers: {},
    query: {},
    body: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as NextApiRequest
}

function response() {
  const result = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as (Record<string, unknown> & { loginApiUrl?: string }) | undefined,
    status(code: number) { this.statusCode = code; return this },
    setHeader(name: string, value: string) { this.headers[name] = value; return this },
    json(body: Record<string, unknown>) { this.body = body; return this },
    end() { return this },
  }
  return result as unknown as NextApiResponse & typeof result
}

describe('Player Launcher Play endpoints', () => {
  const previousMode = process.env.BOX_DEPLOYMENT_MODE
  const previousTicketSecret = process.env.PERMISSION_TOKEN_SECRET

  beforeEach(() => { process.env.BOX_DEPLOYMENT_MODE = 'play' })

  afterAll(() => {
    if (previousMode === undefined) delete process.env.BOX_DEPLOYMENT_MODE
    else process.env.BOX_DEPLOYMENT_MODE = previousMode
    if (previousTicketSecret === undefined) delete process.env.PERMISSION_TOKEN_SECRET
    else process.env.PERMISSION_TOKEN_SECRET = previousTicketSecret
  })

  test('bootstrap reveals only basic server state and never a map list', async () => {
    const handler = createPlayerLauncherBootstrapHandler(() => ({ keyId: 'key-1', publicKey: {} }))
    const res = response()
    await handler(request(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      protocolVersion: 1,
      serverName: '',
      loginRequired: true,
      loginApiUrl: '',
      signingKey: { keyId: 'key-1', publicKey: {} },
    })
  })

  test('bootstrap retains the publicly configured login portal prefix', async () => {
    const original = process.env.BOX_PLAYER_LOGIN_URL
    try {
      process.env.BOX_PLAYER_LOGIN_URL = 'https://auth.example.test/accounts'
      const handler = createPlayerLauncherBootstrapHandler(() => ({ keyId: 'key-1', publicKey: {} }))
      const res = response()
      await handler(request(), res)
      expect(res.body?.loginApiUrl).toBe('https://auth.example.test/accounts/api/auth/login')
    } finally {
      if (original === undefined) delete process.env.BOX_PLAYER_LOGIN_URL
      else process.env.BOX_PLAYER_LOGIN_URL = original
    }
  })

  test('map discovery is available without a server-side access switch', async () => {
    let authenticationAttempted = false
    const handler = createPlayerLauncherMapsHandler({
      getWorlds: () => [],
      getPlayerIp: () => '127.0.0.1',
      resolveIdentity: async () => {
        authenticationAttempted = true
        return { identity: {} as never, assertion: 'signed' }
      },
    })
    const res = response()
    await handler(request(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ worlds: [] })
    expect(authenticationAttempted).toBe(true)
  })

  test('map discovery still requires an authenticated player', async () => {
    let mapListRead = false
    const handler = createPlayerLauncherMapsHandler({
      getWorlds: () => { mapListRead = true; return [] },
      getPlayerIp: () => '127.0.0.1',
      resolveIdentity: async () => { throw new PlayerAuthenticationRequiredError() },
    })
    const res = response()
    await handler(request(), res)
    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({ code: 'AUTH_REQUIRED' })
    expect(mapListRead).toBe(false)
  })

  test('map details return only after identity verification', async () => {
    const handler = createPlayerLauncherMapsHandler({
      getPlayerIp: () => '127.0.0.1',
      resolveIdentity: async () => ({ identity: {} as never, assertion: 'signed' }),
      getAllWorlds: () => [{ id: 'map-one', publicId: 'map-one', mapGroupId: 'map-group', mainProjectId: 'map-one' }] as never,
      getPresenceCounts: () => ({ 'map-one': { onlineCount: 3 } }),
      getWorlds: () => [{
        id: 'map-one',
        permanentMapId: 'permanent-one',
        publicId: 'map-one',
        name: '地图一',
        author: '作者',
        description: '',
        cover: '',
        version: 'v1',
        mapGroupId: 'map-one',
        mapRole: 'main',
        mainProjectId: 'map-one',
        playEnabled: true,
      }],
    })
    const res = response()
    await handler(request(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ worlds: [{ permanentMapId: 'permanent-one', name: '地图一', onlineCount: 3 }] })
  })

  test('descriptor endpoint checks player session and map visibility', async () => {
    let descriptorRequested = false
    const dependencies = {
      getWorlds: () => [{ id: 'world-one', publicId: 'world-one' }] as never,
      getDescriptor: (() => { descriptorRequested = true; return { manifestDigest: 'signed-digest' } }) as never,
      getPlayerIp: () => '127.0.0.1',
      resolveIdentity: async () => { throw new PlayerAuthenticationRequiredError() },
    }
    const handler = createPlayerLauncherDescriptorHandler(dependencies)
    const requestFor = (mapId: string) => ({ ...request(), query: { mapId } }) as unknown as NextApiRequest
    const unauthorized = response()
    await handler(requestFor('world-one'), unauthorized)
    expect(unauthorized.statusCode).toBe(401)
    expect(descriptorRequested).toBe(false)

    const authenticatedHandler = createPlayerLauncherDescriptorHandler({
      ...dependencies,
      resolveIdentity: async () => ({ identity: {} as never, assertion: 'signed' }),
    })
    const hidden = response()
    await authenticatedHandler(requestFor('private-world'), hidden)
    expect(hidden.statusCode).toBe(404)
    expect(descriptorRequested).toBe(false)

    const allowed = response()
    await authenticatedHandler(requestFor('world-one'), allowed)
    expect(allowed.statusCode).toBe(200)
    expect(allowed.body).toEqual({ manifestDigest: 'signed-digest' })
  })

})

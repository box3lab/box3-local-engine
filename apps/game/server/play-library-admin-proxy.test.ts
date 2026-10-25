import { afterAll, describe, expect, jest, test } from '@jest/globals'
import type { NextApiRequest, NextApiResponse } from 'next'

// Authorization itself is covered by player-admin-route tests. Here we check
// section dispatch so deleted settings cannot fall through to map imports.
jest.mock('./player-admin-route', () => ({
  playerAdminRoute: (_options: unknown, handler: (context: unknown) => unknown) =>
    (req: unknown, res: unknown) => handler({ req, res }),
}))
const { playLibraryAdminRoute } = jest.requireActual(
  './play-library-admin-proxy',
) as typeof import('./play-library-admin-proxy');

describe('Play library administration section routing', () => {
  const originalFetch = globalThis.fetch
  const originalUrl = process.env.BOX_PLAY_INTERNAL_URL
  const originalToken = process.env.BOX_PLAY_ADMIN_TOKEN
  afterAll(() => {
    globalThis.fetch = originalFetch
    if (originalUrl === undefined) delete process.env.BOX_PLAY_INTERNAL_URL
    else process.env.BOX_PLAY_INTERNAL_URL = originalUrl
    if (originalToken === undefined) delete process.env.BOX_PLAY_ADMIN_TOKEN
    else process.env.BOX_PLAY_ADMIN_TOKEN = originalToken
  })
  function response() {
    return {
      statusCode: 200, body: undefined as unknown,
      status(value: number) { this.statusCode = value; return this },
      json(value: unknown) { this.body = value; return this },
      end() { return this }, setHeader() { return this },
    }
  }
  test.each(['resource-cache', 'player-launcher-access', 'unknown'])('rejects removed or unknown section %s', async (section) => {
    const fetch = jest.fn<typeof globalThis.fetch>()
    globalThis.fetch = fetch
    const res = response()
    await playLibraryAdminRoute({ method: 'POST', query: { section }, headers: {} } as unknown as NextApiRequest, res as unknown as NextApiResponse)
    expect(res.statusCode).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })
  test('keeps the legitimate map management route', async () => {
    process.env.BOX_PLAY_INTERNAL_URL = 'http://play.test'
    process.env.BOX_PLAY_ADMIN_TOKEN = 'fixture-play-admin-token'
    const fetch = jest.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    globalThis.fetch = fetch
    const res = response()
    await playLibraryAdminRoute({ method: 'GET', query: { section: 'worlds' }, headers: {} } as unknown as NextApiRequest, res as unknown as NextApiResponse)
    expect(fetch.mock.calls[0][0]).toBe('http://play.test/api/play-admin/worlds')
    expect(res.statusCode).toBe(204)
  })
})

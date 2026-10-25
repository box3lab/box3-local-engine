import { prewarmLocalRuntimes } from './runtime-prewarm';

describe('local runtime prewarm', () => {
  const originalFetch = global.fetch;
  const originalEditURL = process.env.LOCAL_EDIT_SERVER_URL;
  const originalPlayURL = process.env.LOCAL_GAME_SERVER_URL;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEditURL === undefined) delete process.env.LOCAL_EDIT_SERVER_URL;
    else process.env.LOCAL_EDIT_SERVER_URL = originalEditURL;
    if (originalPlayURL === undefined) delete process.env.LOCAL_GAME_SERVER_URL;
    else process.env.LOCAL_GAME_SERVER_URL = originalPlayURL;
  });

  test('schedules every requested project without waiting for engine startup', async () => {
    process.env.LOCAL_EDIT_SERVER_URL = 'http://127.0.0.1:9968/';
    process.env.LOCAL_GAME_SERVER_URL = 'http://127.0.0.1:9967/';
    global.fetch = jest.fn(async () => new Response(null, { status: 202 }));

    const results = await prewarmLocalRuntimes(
      ['main-map', 'sub-map'],
      ['edit', 'play'],
    );

    expect(results).toHaveLength(4);
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:9968/main-map/__local_runtime/start',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:9967/sub-map/__local_runtime/start',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

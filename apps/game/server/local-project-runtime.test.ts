import { stopLocalProjectRuntimes } from './local-project-runtime';

describe('stopLocalProjectRuntimes', () => {
  test('stops edit and play runtimes for each project before deletion', async () => {
    const requests: string[] = [];
    const request = jest.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;

    await stopLocalProjectRuntimes(['main-map', 'sub-map'], request);

    expect(requests).toEqual([
      'http://127.0.0.1:9967/main-map/__local_runtime/destroy',
      'http://127.0.0.1:9966/main-map/__local_runtime/destroy',
      'http://127.0.0.1:9967/sub-map/__local_runtime/destroy',
      'http://127.0.0.1:9966/sub-map/__local_runtime/destroy',
    ]);
  });

  test('does not allow deletion to continue when a runtime cannot be stopped', async () => {
    const request = jest.fn(async () => new Response(null, { status: 500 })) as unknown as typeof fetch;

    await expect(stopLocalProjectRuntimes(['map'], request)).rejects.toThrow(
      '无法停止地图 map 的编辑运行时（HTTP 500）',
    );
  });
});

type RuntimeMode = 'edit' | 'play';

function runtimePort(mode: RuntimeMode) {
  return Number(
    mode === 'edit'
      ? process.env.BOX_EDIT_RUNTIME_PORT ||
          process.env.BOX_EDIT_SERVER_PORT ||
          9967
      : process.env.BOX_PLAY_RUNTIME_PORT ||
          process.env.BOX_SERVER_PORT ||
          9966,
  );
}

export async function stopLocalProjectRuntimes(
  projectIds: string[],
  request: typeof fetch = fetch,
) {
  await Promise.all(
    projectIds.flatMap((projectId) =>
      (['edit', 'play'] as const).map(async (mode) => {
        let response: Response;
        try {
          response = await request(
            `http://127.0.0.1:${runtimePort(mode)}/${encodeURIComponent(projectId)}/__local_runtime/destroy`,
            {
              method: 'POST',
              signal: AbortSignal.timeout(10_000),
            },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw Object.assign(
            new Error(`无法连接地图 ${projectId} 的${mode === 'edit' ? '编辑' : '游玩'}运行时：${message}`),
            { statusCode: 503 },
          );
        }
        if (!response.ok) {
          throw Object.assign(
            new Error(
              `无法停止地图 ${projectId} 的${mode === 'edit' ? '编辑' : '游玩'}运行时（HTTP ${response.status}）`,
            ),
            { statusCode: 503 },
          );
        }
      }),
    ),
  );
}

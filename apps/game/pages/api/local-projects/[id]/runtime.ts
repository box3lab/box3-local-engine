import type { NextApiRequest, NextApiResponse } from 'next';
import { allowAuthenticatedCreatorApi } from '../../../../server/creator-api-security';
import { publicPath } from '../../../../server/public-path';

type RuntimeMode = 'edit' | 'play';

function runtimePort(mode: RuntimeMode) {
  return Number(
    mode === 'play'
      ? process.env.BOX_PLAY_RUNTIME_PORT ||
          process.env.BOX_SERVER_PORT ||
          9966
      : process.env.BOX_EDIT_RUNTIME_PORT ||
          process.env.BOX_EDIT_SERVER_PORT ||
          9967,
  );
}

async function runtimeControl(projectId: string, mode: RuntimeMode, action: 'start' | 'status') {
  const response = await fetch(
    `http://127.0.0.1:${runtimePort(mode)}/${encodeURIComponent(projectId)}/__local_runtime/${action}`,
    {
      method: action === 'start' ? 'POST' : 'GET',
      ...(action === 'start' ? { headers: { 'x-box-runtime-restart': '1' } } : {}),
      signal: AbortSignal.timeout(10_000),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `${mode === 'edit' ? '编辑' : '游玩'}运行时启动失败（HTTP ${response.status}）`);
  }
  return data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!await allowAuthenticatedCreatorApi(req, res, req.method === 'POST' ? 'projects.edit' : 'projects.view')) return;
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) return res.status(400).json({ message: 'Project ID is required' });
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(id)) {
    return res.status(400).json({ message: 'Invalid project ID' });
  }
  const queryMode = Array.isArray(req.query.mode) ? req.query.mode[0] : req.query.mode;
  const requestedMode = req.method === 'GET' ? queryMode : req.body?.mode;
  const mode: RuntimeMode = requestedMode === 'play' ? 'play' : 'edit';

  try {
    const status = await runtimeControl(id, mode, req.method === 'POST' ? 'start' : 'status');
    return res.status(req.method === 'POST' ? 202 : 200).json({
      ...status,
      editUrl: publicPath(`/e/${id}`),
      playUrl: publicPath(`/p/${id}`),
    });
  } catch (error) {
    return res.status(500).json({
      message: (error as Error).message || '启动作品失败',
    });
  }

}

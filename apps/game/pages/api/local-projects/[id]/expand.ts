import type { NextApiRequest, NextApiResponse } from 'next';
import { allowAuthenticatedCreatorApi } from '../../../../server/creator-api-security';
import { getLocalProjectManager } from '../../../../server/local-project-manager';
import { LOCAL_RUNTIME_OPERATION_TIMEOUT_MS } from '../../../../shared/local-runtime-timeouts';

function editRuntimePort() {
  return Number(
    process.env.BOX_EDIT_RUNTIME_PORT ||
      process.env.BOX_EDIT_SERVER_PORT ||
      9967,
  );
}

async function postToEditRuntime(projectId: string, route: string, body?: unknown) {
  const response = await fetch(
    `http://127.0.0.1:${editRuntimePort()}/${encodeURIComponent(projectId)}/internal/${route}`,
    {
      method: 'POST',
      ...(body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
      signal: AbortSignal.timeout(LOCAL_RUNTIME_OPERATION_TIMEOUT_MS),
    },
  );
  const text = await response.text();
  let data: { message?: string; alreadyExpanded?: boolean } = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }
  if (!response.ok) {
    throw new Error(data.message || `地图扩容失败（HTTP ${response.status}）`);
  }
  return data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!await allowAuthenticatedCreatorApi(req, res, 'projects.edit')) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) return res.status(400).json({ message: 'Project ID is required' });
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(id)) {
    return res.status(400).json({ message: 'Invalid project ID' });
  }
  const shape = req.body?.shape;
  if (
    !shape ||
    !Number.isInteger(shape.x) ||
    !Number.isInteger(shape.y) ||
    !Number.isInteger(shape.z)
  ) {
    return res.status(400).json({ message: '请提供有效的目标地图尺寸。' });
  }

  try {
    const manager = getLocalProjectManager();
    manager.getProject(id);
    const validation = await postToEditRuntime(
      id,
      'validate-local-project-expansion',
      { shape },
    );
    if (!validation.alreadyExpanded) {
      await postToEditRuntime(id, 'save-local-project');
      const snapshot = manager.createProjectSnapshot(id, 'before-expansion');
      if (!snapshot.created && !snapshot.archivePath) {
        throw new Error('无法创建扩容前的地图恢复快照，已取消扩容。');
      }
    }
    const result = await postToEditRuntime(id, 'expand-local-project', { shape });
    const project = manager.updateProjectMapSize(id, [shape.x, shape.y, shape.z]);
    return res.status(200).json({ ...result, project });
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}

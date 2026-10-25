import { describe, expect, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectProgressDialogs } from '../components/project-management/dialogs/project-progress-dialogs';

import {
  compatibilityDiagnostics,
  importResponseError,
  serializeImportError,
} from './import-diagnostics';

describe('map import diagnostics', () => {
  test('preserves structured validation issues returned by an import API', () => {
    const error = importResponseError(
      {
        message: '工程包校验失败',
        details: [
          {
            level: 'error',
            code: 'missing-blob',
            message: '缺少资源 blob QmMissing',
          },
          { level: 'warning', code: 'empty-script', message: '入口脚本为空' },
        ],
      },
      400,
      '导入工程失败',
    );

    expect(error.message).toBe('工程包校验失败');
    expect(error.details).toEqual([
      {
        level: 'error',
        code: 'missing-blob',
        message: '缺少资源 blob QmMissing',
      },
      { level: 'warning', code: 'empty-script', message: '入口脚本为空' },
    ]);
  });

  test('turns compatibility errors and warnings into visible map-specific rows', () => {
    expect(
      compatibilityDiagnostics({
        errors: [
          {
            code: 'missing-blob',
            hash: 'QmMissing',
            message: '缺少资源 blob QmMissing',
          },
        ],
        warnings: [{ code: 'cloud-http', message: '检测到云端 API 地址' }],
      }),
    ).toEqual([
      {
        level: 'error',
        code: 'missing-blob',
        message: '缺少资源 blob QmMissing',
      },
      { level: 'warning', code: 'cloud-http', message: '检测到云端 API 地址' },
    ]);
  });

  test('serializes nested server errors without exposing stack traces', () => {
    const nested = Object.assign(new Error('地图组成员关系无效'), {
      code: 'INVALID_MAP_GROUP',
    });
    const error = Object.assign(new Error('工程包校验失败'), {
      details: [{ code: 'missing-main', message: '缺少主地图' }],
      cause: nested,
    });

    expect(serializeImportError(error)).toEqual({
      message: '工程包校验失败',
      details: [
        { level: 'error', code: 'missing-main', message: '缺少主地图' },
        {
          level: 'error',
          code: 'INVALID_MAP_GROUP',
          message: '地图组成员关系无效',
        },
      ],
    });
  });

  test('creator and play import dialogs render every returned check detail', () => {
    const root = path.resolve(__dirname, '..');
    const creatorTransfer = fs.readFileSync(
      path.join(
        root,
        'components/project-management/workflows/use-project-transfer.ts',
      ),
      'utf8',
    );
    const playPage = fs.readFileSync(
      path.join(root, 'pages/index.tsx'),
      'utf8',
    );
    const creatorApi = fs.readFileSync(
      path.join(root, 'pages/api/local-projects/import.ts'),
      'utf8',
    );
    const playApi = fs.readFileSync(
      path.join(root, 'pages/api/play-admin/import.ts'),
      'utf8',
    );

    expect(creatorTransfer).toContain('importResponseError');
    expect(creatorTransfer).toContain('compatibilityDiagnostics(report)');
    expect(playPage).toContain('importResponseError');
    expect(playPage).toContain('importProgress.details.map');
    expect(playPage).toContain('检查详情');
    const html = renderToStaticMarkup(
      createElement(ProjectProgressDialogs, {
        exportProgress: null,
        publishProgress: null,
        importProgress: {
          filename: 'town.boxproject',
          phase: 'error',
          percent: 75,
          sent: 10,
          total: 10,
          elapsedSeconds: 1,
          message: '导入工程失败',
          details: [
            {
              level: 'error',
              code: 'missing-blob',
              message: '缺少资源 QmMissing',
            },
            { level: 'warning', code: 'empty-script', message: '入口脚本为空' },
          ],
        },
        closeExport: () => {},
        closeImport: () => {},
        closePublish: () => {},
      }),
    );
    expect(html).toContain('检查详情');
    expect(html).toContain('1 个错误 · 1 个提醒');
    expect(html).toContain('缺少资源 QmMissing');
    expect(html).toContain('入口脚本为空');
    expect(html).toContain('<code>missing-blob</code>');
    expect(html).toContain('<code>empty-script</code>');
    expect(creatorApi).toContain('serializeImportError(error)');
    expect(playApi).toContain('serializeImportError(error)');
  });
});

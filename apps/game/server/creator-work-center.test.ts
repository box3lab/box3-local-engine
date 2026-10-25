import fs from 'fs';
import path from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectCard } from '../components/project-management/catalog/project-card';
import type { LocalProject } from '../components/project-management/project-types';

const root = path.resolve(__dirname, '..');

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Creator work center model integration', () => {
  test('offers maps and models in one work center', () => {
    const page = source('pages/projects/index.tsx');
    const library = source('components/creator-model-library.tsx');
    expect(page).toContain('aria-label="创作中心"');
    expect(page).toContain('地图列表');
    expect(page).toContain('模型列表');
    expect(page).not.toContain('href="/system"');
    expect(page).toContain('<CreatorModelLibrary');
    expect(page).toContain('voxaUrl={voxaUrl}');
    expect(page).toContain(
      "canManageModels={creatorPermissions.includes('models.manage')}",
    );
    expect(page).toContain('<ProjectCatalog');
    expect(page).toContain('renderProjectCard={renderProjectCard}');
    expect(library).toContain('模型作品');
    expect(library).toContain('styles.sectionHeader');
    expect(library).toContain('className={styles.cardLink}');
    expect(library).not.toContain('<Pencil size={13} />编辑</button>');
  });

  test('opens a map from its accessible card and offers contextual actions', () => {
    const project = {
      id: 'town',
      name: '测试地图',
      mapRole: 'main',
      mainProjectId: 'town',
      author: '测试作者',
      description: '测试简介',
      theme: 'sunset',
      latestRelease: 'v1.0.0',
    } as LocalProject;
    const noop = () => {};
    const html = renderToStaticMarkup(
      createElement(ProjectCard, {
        project,
        projects: [project],
        menuProject: 'town',
        exportProgress: null,
        setMenuProject: noop,
        openEditor: noop,
        editDetails: noop,
        createSubmap: noop,
        expandMap: noop,
        exportProject: noop,
        recoverProject: noop,
        deleteProject: noop,
      }),
    );
    expect(html).toContain('aria-label="编辑地图 测试地图"');
    expect(html).toContain('role="menu"');
    for (const label of [
      '编辑信息',
      '新建副地图',
      '导出',
      '恢复历史版本',
      '删除',
    ]) {
      expect(html).toContain(label);
    }
  });

  test('shows a recovery message when VOXA is unavailable', () => {
    const library = source('components/creator-model-library.tsx');
    expect(library).toContain('模型服务未运行');
    expect(library).toContain('重新检测');
  });

  test('protects the creator model APIs with authenticated creator access', () => {
    for (const endpoint of [
      'pages/api/creator-models/index.ts',
      'pages/api/creator-models/[id].ts',
      'pages/api/creator-models/import.ts',
      'pages/api/creator-models/[id]/export.ts',
      'pages/api/creator-models/blobs/[hash].ts',
    ]) {
      expect(source(endpoint)).toContain('allowAuthenticatedCreatorApi');
    }
  });

  test('forwards the authenticated creator identity when importing a VOXA project', () => {
    const endpoint = source('pages/api/creator-models/import.ts');
    expect(endpoint).toContain('creatorModelIdentityHeaders');
    expect(endpoint).toMatch(
      /requestCreatorModelService\([\s\S]*headers:\s*\{[\s\S]*\.\.\.creatorModelIdentityHeaders\(req\)/,
    );
  });

  test('forwards creator identity when proxying protected VOXA reads', () => {
    for (const endpoint of [
      'pages/api/creator-models/index.ts',
      'pages/api/creator-models/[id]/export.ts',
      'pages/api/creator-models/blobs/[hash].ts',
    ]) {
      const contents = source(endpoint);
      expect(contents).toContain('creatorModelIdentityHeaders');
      expect(contents).toMatch(
        /requestCreatorModelService\([\s\S]*headers:\s*creatorModelIdentityHeaders\(req\)/,
      );
    }
  });

  test('allows map editors to read existing models without model-management permission', () => {
    expect(source('pages/api/creator-models/index.ts')).toContain(
      "['projects.edit', 'models.manage']",
    );
    expect(source('pages/api/creator-models/blobs/[hash].ts')).toContain(
      "['projects.edit', 'models.manage']",
    );
  });

  test('requires current edit permission before rendering a map editor', () => {
    const editorPage = source('app/e/[container]/page.tsx');
    expect(editorPage).toContain(
      "hasCreatorCapability(identity.creatorPermissions, 'projects.edit')",
    );
    expect(editorPage).toContain('identity.creatorAccess');
    expect(editorPage).not.toContain('hasAuthenticatedPlayer(');
  });

  test('returns an authorized creator from the access-required page to the work center', () => {
    const page = source('pages/creator-access-required.tsx');
    expect(page).toContain('if (identity.creatorAccess)');
    expect(page).toContain("destination: '/projects'");
  });

  test('keeps the VOXA container health check independent from the removed library route', () => {
    const dockerfile = source('../local-engine/Dockerfile');
    const voxaStage = dockerfile.slice(
      dockerfile.indexOf('FROM runtime-base AS voxa'),
    );
    expect(voxaStage).toContain(
      "fetch('http://127.0.0.1:3001/api/health-check')",
    );
    expect(voxaStage).not.toContain("fetch('http://127.0.0.1:3001/library')");
  });

  test('does not expose a separate VOXA library route', () => {
    expect(fs.existsSync(path.join(root, '../voxa/pages/library.tsx'))).toBe(
      false,
    );
  });

  test('keeps local VOXA save-only without a platform publish action', () => {
    const navBar = source('../voxa/src/views/nav-bar/index.tsx');
    expect(navBar).toContain('<SaveButton />');
    expect(navBar).not.toContain('PublishButton');
    expect(
      fs.existsSync(
        path.join(root, '../voxa/src/views/nav-bar/publish-button.tsx'),
      ),
    ).toBe(false);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ProjectEditorDialog,
  type ProjectEditorController,
} from '../components/project-management/dialogs/project-editor-dialog';
import { readProjectImage } from '../components/project-management/project-fixtures';

const projectsDirectory = path.resolve(__dirname, '../pages/projects');
const styleSource = fs.readFileSync(
  path.join(projectsDirectory, 'projects.module.css'),
  'utf8',
);
const projectApiSource = fs.readFileSync(
  path.resolve(__dirname, '../pages/api/local-projects/[id].ts'),
  'utf8',
);
const projectPageSource = fs.readFileSync(
  path.resolve(__dirname, '../pages/projects/index.tsx'),
  'utf8',
);
const expandApiSource = fs.readFileSync(
  path.resolve(__dirname, '../pages/api/local-projects/[id]/expand.ts'),
  'utf8',
);
const projectManagerSource = fs.readFileSync(
  path.resolve(__dirname, '../../local-engine/src/project-manager.js'),
  'utf8',
);
const playHomeSource = fs.readFileSync(
  path.resolve(__dirname, '../pages/index.tsx'),
  'utf8',
);

function renderDetails() {
  const noop = () => {};
  const controller = {
    dialog: 'details',
    submitting: false,
    selectedProject: null,
    projectName: '测试地图',
    projectPublicId: 'test-map',
    projectAuthor: '测试作者',
    projectDescription: '',
    projectCover: '',
    projectLoadingCover: '',
    mapSize: 'small',
    customMapSize: [32, 32, 32],
    customSizeFeedback: null,
    releaseVersion: 'v1.0.0',
    releaseNotes: '',
    assetMode: 'local',
    assetConfig: {},
    savingAssetConfig: false,
    dialogError: '',
    setDialog: noop,
    setSubmitting: noop,
    setDialogError: noop,
    setProjectName: noop,
    setProjectPublicId: noop,
    setProjectAuthor: noop,
    setProjectDescription: noop,
    setProjectCover: noop,
    setProjectLoadingCover: noop,
    setMapSize: noop,
    updateCustomMapSize: noop,
    setReleaseVersion: noop,
    setReleaseNotes: noop,
    setAssetMode: noop,
    setAssetConfig: noop,
    submitProject: noop,
    saveAssetConfiguration: noop,
  } as unknown as ProjectEditorController;
  return renderToStaticMarkup(
    createElement(ProjectEditorDialog, { controller }),
  );
}

describe('creator project editor dialog', () => {
  test('keeps map expansion waits longer than the managed runtime startup window', () => {
    expect(projectPageSource).toContain(
      'Date.now() + LOCAL_RUNTIME_OPERATION_TIMEOUT_MS',
    );
    expect(expandApiSource).toContain(
      'AbortSignal.timeout(LOCAL_RUNTIME_OPERATION_TIMEOUT_MS)',
    );
  });

  test('stops edit and play runtimes before deleting a map', () => {
    expect(projectApiSource).toContain('await stopLocalProjectRuntimes');
    expect(projectApiSource).toContain('manager.listMapGroup(id)');
  });

  test('keeps modal backdrops above the fixed creator footer', () => {
    const backdropZIndex = Number(
      styleSource.match(/\.dialogBackdrop\s*\{[^}]*z-index:\s*(\d+);/s)?.[1],
    );
    const footerZIndex = Number(
      styleSource.match(/\.creatorFooter\s*\{[^}]*z-index:\s*(\d+);/s)?.[1],
    );
    const progressBackdropZIndex = Number(
      styleSource.match(/\.exportBackdrop\s*\{[^}]*z-index:\s*(\d+);/s)?.[1],
    );
    expect(backdropZIndex).toBeGreaterThan(footerZIndex);
    expect(progressBackdropZIndex).toBeGreaterThan(footerZIndex);
  });

  test('uses a roomy, viewport-safe details dialog', () => {
    const html = renderDetails();
    expect(html).toContain('detailsDialog');
    expect(html).toContain('<h2>编辑信息</h2>');
    expect(styleSource).toMatch(
      /\.detailsDialog\s*\{[^}]*width:\s*min\(100%,\s*620px\);[^}]*max-height:\s*calc\(100(?:dvh|vh)\s*-\s*48px\);[^}]*overflow-y:\s*auto;/s,
    );
  });

  test('groups labels, controls and help text into stable field rows', () => {
    const html = renderDetails();
    expect(html).toContain('dialogFields');
    expect(
      html.match(/class="fieldGroup"/g)?.length || 0,
    ).toBeGreaterThanOrEqual(5);
    expect(html).toContain('value="测试地图"');
    expect(html).toContain('value="test-map"');
    expect(styleSource).toMatch(
      /\.dialogFields\s*\{[^}]*display:\s*grid;[^}]*gap:\s*16px;/s,
    );
    expect(styleSource).toMatch(
      /\.fieldGroup\s*\{[^}]*display:\s*grid;[^}]*gap:\s*7px;/s,
    );
  });

  test('provides separate square artwork and widescreen loading cover pickers', () => {
    const html = renderDetails();
    expect(html).toContain('id="project-cover"');
    expect(html).toContain('id="project-loading-cover"');
    expect(html.match(/type="file"/g)).toHaveLength(2);
    expect(html).toContain('1:1 · PNG、JPG 或 WebP');
    expect(html).toContain('16:9 · 进入地图时展示');
    expect(styleSource).toMatch(
      /\.coverPreviewSquare\s*\{[^}]*aspect-ratio:\s*1;/s,
    );
    expect(styleSource).toMatch(
      /\.coverPreviewWide\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9;/s,
    );
    expect(styleSource).toMatch(
      /\.coverFileInput\s*\{[^}]*position:\s*absolute;[^}]*opacity:\s*0;/s,
    );
  });

  test('rejects oversized project images and reserves room for two encoded covers', async () => {
    await expect(
      readProjectImage({ size: 3 * 1024 * 1024 + 1 } as File, '作品封面', 1),
    ).rejects.toThrow('作品封面不能超过 3MB');
    expect(renderDetails().match(/最大 3MB/g)).toHaveLength(2);
    expect(projectApiSource).toMatch(
      /bodyParser:\s*\{\s*sizeLimit:\s*'10mb'\s*\}/,
    );
    expect(projectManagerSource).toContain(
      'const projectImageMaxBytes = 3 * 1024 * 1024',
    );
    expect(projectManagerSource).toContain('projectImageMaxDataUrlBytes');
  });

  test('uses compact square artwork cards on the Play home page', () => {
    expect(playHomeSource).toContain('src={main.cover || DEFAULT_MAP_COVER}');
    expect(playHomeSource).toMatch(
      /\.playWorkCenter \.playerGrid \.cover\s*\{[^}]*aspect-ratio:\s*1;/s,
    );
    expect(playHomeSource).toMatch(
      /\.playerGrid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill, minmax\(208px, 224px\)\);[^}]*justify-content:\s*start;/s,
    );
  });

  test('uses the same square artwork cover ratio in the Creator gallery', () => {
    expect(styleSource).toMatch(
      /\/\* Project discovery[\s\S]*?\.cover,\s*\.coverSunset,[\s\S]*?aspect-ratio:\s*1;/,
    );
  });
});

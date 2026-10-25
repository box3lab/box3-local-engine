import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { GetServerSideProps, NextApiRequest, NextApiResponse } from 'next';
import { IntlProvider } from 'react-intl';
import {
  Grid2X2,
  Play,
  Map as MapIcon,
  Box,
} from 'lucide-react';
import styles from './projects.module.css';
import { customMapSizeMessage } from '../../components/project-management/project-presentation';
import zhMessages from '../../i18n/zh.json';
import { CreatorModelLibrary } from '../../components/creator-model-library';
import { resolvePublicUrl } from '../../src/utils/public-url';
import {
  PlayerAccount,
  type PlayerAccountIdentity,
  type PlayerProfileChanges,
} from '../../components/player-account/player-account';
import { playerLoginURL, requestPlayerServiceIp, resolvePlayerServiceIdentity } from '../../server/player-service-client';
import type {
  LocalProject,
  MapSizeChoice,
  ProjectsPageProps,
  WorkCenterView,
} from '../../components/project-management/project-types';
import { ProjectCard } from '../../components/project-management/catalog/project-card';
import { ProjectCatalog } from '../../components/project-management/catalog/project-catalog';
import { useProjectCatalog } from '../../components/project-management/catalog/use-project-catalog';
import { ProjectProgressDialogs } from '../../components/project-management/dialogs/project-progress-dialogs';
import { ProjectExportChoiceDialog, ProjectImportChoiceDialog } from '../../components/project-management/dialogs/project-choice-dialogs';
import { ProjectRecoveryDialog } from '../../components/project-management/dialogs/project-recovery-dialog';
import { ProjectEditorDialog, type ProjectEditorController } from '../../components/project-management/dialogs/project-editor-dialog';
import { useProjectTransfer } from '../../components/project-management/workflows/use-project-transfer';
import { useProjectRecovery } from '../../components/project-management/workflows/use-project-recovery';
import { useProjectPublisher } from '../../components/project-management/workflows/use-project-publisher';
import { openProjectEditor } from '../../components/project-management/project-runtime-navigation';
import { apiClient } from '../../src/apis/client';
import { LOCAL_RUNTIME_OPERATION_TIMEOUT_MS } from '../../shared/local-runtime-timeouts';

export const getServerSideProps: GetServerSideProps<ProjectsPageProps> = async ({ req, res, query }) => {
  if (['play', 'player-service'].includes(process.env.BOX_DEPLOYMENT_MODE || '')) {
    return { notFound: true };
  }
  try {
    const { identity } = await resolvePlayerServiceIdentity(
      req as NextApiRequest,
      res as NextApiResponse,
      requestPlayerServiceIp(req as NextApiRequest),
    );
    if (!identity.creatorAccess) {
      return { redirect: { destination: '/creator-access-required', permanent: false } };
    }
    return {
      props: {
        voxaUrl: (process.env.VOXA_URL || '').replace(/\/$/, ''),
        initialView: query.view === 'models' ? 'models' : 'maps',
        uiPreview: false,
        creator: {
          displayName: identity.displayName,
          username: identity.username,
          userId: identity.userId,
          boxId: identity.boxId,
          avatarSkinId: identity.avatarSkinId,
          creatorPermissions: [...identity.creatorPermissions],
        },
      },
    };
  } catch {
    return { redirect: { destination: playerLoginURL('creator'), permanent: false } };
  }
};

export default function ProjectsPage({
  voxaUrl,
  initialView,
  uiPreview,
  creator,
}: ProjectsPageProps) {
  const [activeView, setActiveView] = useState<WorkCenterView>(initialView);
  const [creatorPermissions, setCreatorPermissions] = useState<string[]>(
    creator.creatorPermissions,
  );
  const [menuProject, setMenuProject] = useState<string | null>(null);
  const [creatorIdentity, setCreatorIdentity] = useState<PlayerAccountIdentity>(creator);
  const [dialog, setDialog] = useState<
    'create' | 'submap' | 'expand' | 'delete' | 'details' | 'publish' | null
  >(null);
  const [projectName, setProjectName] = useState('');
  const [projectPublicId, setProjectPublicId] = useState('');
  const [projectAuthor, setProjectAuthor] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectCover, setProjectCover] = useState('');
  const [projectLoadingCover, setProjectLoadingCover] = useState('');
  const [mapSize, setMapSize] = useState<MapSizeChoice>('medium');
  const [customMapSize, setCustomMapSize] = useState<[number, number, number]>([64, 128, 64]);
  const [dialogError, setDialogError] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProject, setSelectedProject] = useState<LocalProject | null>(null);
  const [notice, setNotice] = useState('');
  const customSizeFeedback = mapSize === 'custom' ? customMapSizeMessage(customMapSize) : null;
  const updateCustomMapSize = (index: 0 | 1 | 2, value: string) => {
    setCustomMapSize((current) => {
      const next = [...current] as [number, number, number];
      next[index] = Number(value);
      return next;
    });
  };

  const logoutCreator = async () => {
    if (uiPreview) {
      setNotice('预览模式：已模拟退出登录。');
      return;
    }
    await apiClient.postApiCreatorLogout();
    window.location.assign(resolvePublicUrl('/projects'));
  };

  const saveCreatorProfile = async (changes: PlayerProfileChanges) => {
    if (uiPreview) {
      setCreatorIdentity((current) => ({ ...current, ...changes }));
      setNotice('资料已保存');
      return;
    }
    const data = (await apiClient.patchApiCreatorProfile({ body: changes })) as {
      player?: PlayerProfileChanges;
    };
    setCreatorIdentity((current) => ({
      ...current,
      displayName: data.player?.displayName || changes.displayName,
      avatarSkinId: data.player?.avatarSkinId || changes.avatarSkinId,
    }));
    setNotice('资料已保存');
  };

  const switchView = async (view: WorkCenterView) => {
    if (view === 'models' && !uiPreview) {
      try {
        const data = (await apiClient.getApiCreatorPermissions({ cache: 'no-store' })) as {
          creatorPermissions?: unknown[];
        };
        if (Array.isArray(data.creatorPermissions)) {
          setCreatorPermissions(data.creatorPermissions.map(String));
        }
      } catch {
        // The model API will surface a concrete message if the service is unavailable.
      }
    }
    setActiveView(view);
    const url = view === 'models' ? '/projects?view=models' : '/projects';
    window.history.replaceState(window.history.state, '', url);
  };

  useEffect(() => {
    const handleHistory = () => {
      setActiveView(
        new URLSearchParams(window.location.search).get('view') === 'models' ? 'models' : 'maps',
      );
    };
    window.addEventListener('popstate', handleHistory);
    return () => window.removeEventListener('popstate', handleHistory);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const catalog = useProjectCatalog({ uiPreview, setNotice });
  const { projects, mainProjects, refresh: refreshProjects } = catalog;
  const transfer = useProjectTransfer({
    mainProjects,
    refreshProjects,
    setNotice,
    closeProjectMenu: () => setMenuProject(null),
  });
  const {
    pendingImportFile, importMode, importTargetMainId, importProgress,
    exportProgress, exportChoiceProject, chooseProjectFile, confirmProjectImport,
    openExportDialog, exportProjectFile, setPendingImportFile, setImportMode,
    setImportTargetMainId, setImportProgress, setExportProgress, setExportChoiceProject,
  } = transfer;
  const recovery = useProjectRecovery({
    refreshProjects,
    setNotice,
    closeProjectMenu: () => setMenuProject(null),
  });
  const publisher = useProjectPublisher({
    projects,
    refreshProjects,
    setNotice,
    closeProjectMenu: () => setMenuProject(null),
    selectProject: setSelectedProject,
    openPublishDialog: () => setDialog('publish'),
    closeDialog: () => setDialog(null),
    setDialogError,
    isSubmitting: () => submitting,
  });

  const openCreateDialog = () => {
    setSelectedProject(null);
    setProjectName('');
    setProjectPublicId('');
    setProjectAuthor('');
    setProjectDescription('');
    setProjectCover('');
    setProjectLoadingCover('');
    setMapSize('medium');
    setCustomMapSize([64, 128, 64]);
    setDialogError('');
    setDialog('create');
  };

  const openSubmapDialog = (project: LocalProject) => {
    setMenuProject(null);
    setSelectedProject(project);
    setProjectName('');
    setProjectPublicId('');
    setProjectDescription('');
    setMapSize('medium');
    setCustomMapSize([64, 128, 64]);
    setDialogError('');
    setDialog('submap');
  };

  const openDetailsDialog = (project: LocalProject) => {
    setMenuProject(null);
    setSelectedProject(project);
    setProjectName(project.name);
    setProjectPublicId(project.publicId || project.id);
    setProjectAuthor(project.author || '');
    setProjectDescription(project.description || '');
    setProjectCover(project.cover || '');
    setProjectLoadingCover(project.loadingCover || '');
    setDialogError('');
    setDialog('details');
  };

  const openExpandDialog = (project: LocalProject) => {
    setMenuProject(null);
    setSelectedProject(project);
    setMapSize('custom');
    setCustomMapSize([512, 96, 512]);
    setDialogError('');
    setDialog('expand');
  };

  const ensureEditRuntimeReady = async (projectId: string) => {
    type RuntimeStatus = {
      phase: 'idle' | 'starting' | 'loading' | 'ready' | 'error';
      message?: string;
    };
    const getStatus = () =>
      apiClient.getApiLocalProjectsIdRuntime({
        params: { path: { id: projectId }, query: { mode: 'edit' } },
      }) as Promise<RuntimeStatus>;
    await apiClient.postApiLocalProjectsIdRuntime({
      params: { path: { id: projectId } },
      body: { mode: 'edit' },
    });
    let status = await getStatus();
    const deadline = Date.now() + LOCAL_RUNTIME_OPERATION_TIMEOUT_MS;
    while (status.phase !== 'ready') {
      if (status.phase === 'error') {
        throw new Error(status.message || '编辑运行时启动失败');
      }
      if (Date.now() >= deadline) {
        throw new Error('等待编辑运行时超时，请稍后重试。');
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      status = await getStatus();
    }
  };

  const submitProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = projectName.trim();
    if ((dialog === 'create' || dialog === 'submap' || dialog === 'details') && !name) return;

    if (dialog === 'expand') {
      if (!selectedProject) throw new Error('请选择要扩容的地图。');
      await ensureEditRuntimeReady(selectedProject.id);
      const response = await fetch(
        `/api/local-projects/${encodeURIComponent(selectedProject.id)}/expand`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shape: {
              x: customMapSize[0],
              y: customMapSize[1],
              z: customMapSize[2],
            },
          }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || `地图扩容失败（HTTP ${response.status}）`);
      }
      setNotice(
        result.alreadyExpanded
          ? `地图尺寸已经是 ${customMapSize.join(' × ')}`
          : `地图已扩容至 ${customMapSize.join(' × ')}，原地图内容已保留`,
      );
      setDialog(null);
      await refreshProjects();
      return;
    }

    if (dialog === 'delete' && selectedProject) {
      await deleteProject(selectedProject);
      setDialog(null);
      return;
    }
    if (dialog === 'publish' && selectedProject) {
      await publisher.publish(selectedProject);
      return;
    } else if (dialog === 'submap' && selectedProject) {
      const id = `${selectedProject.mainProjectId}-map-${Date.now().toString(36)}`.slice(0, 63);
      await apiClient.postApiLocalProjectsIdMaps({
        params: { path: { id: selectedProject.mainProjectId } },
        body: {
            id,
            name,
            description: projectDescription,
            mapSize: mapSize === 'custom' ? customMapSize : mapSize,
        },
      });
      setNotice(`副地图“${name}”已创建`);
    } else if (dialog === 'details' && selectedProject) {
      const data = (await apiClient.patchApiLocalProjectsId({
        params: { path: { id: selectedProject.id } },
        body: {
          publicId: projectPublicId,
          name,
          author: selectedProject.mapRole === 'submap' ? undefined : projectAuthor,
          description: projectDescription,
          cover: projectCover,
          loadingCover: projectLoadingCover,
        },
      })) as { project: { publicId: string } };
      setNotice(`地图信息已保存，玩家链接为 /p/${data.project.publicId}`);
    } else {
      const id = `project-${Date.now().toString(36)}`;
      await apiClient.postApiLocalProjects({
        body: {
          id,
          name,
          author: projectAuthor,
          description: projectDescription,
          mapSize: mapSize === 'custom' ? customMapSize : mapSize,
        },
      });
      setNotice('作品已创建');
    }
    setDialog(null);
    await refreshProjects();
  };

  const deleteProject = async (project: LocalProject) => {
    setMenuProject(null);
    if (project.isEngineWorld) return;
    await apiClient.deleteApiLocalProjectsId({ params: { path: { id: project.id } } });
    setNotice('工程及其本地发布版本已删除');
    await refreshProjects();
  };

  const openDeleteDialog = (project: LocalProject) => {
    setMenuProject(null);
    if (project.isEngineWorld) return;
    setSelectedProject(project);
    setDialogError('');
    setDialog('delete');
  };

  const renderProjectCard = (project: LocalProject) => {
    return (
      <ProjectCard
        key={project.id}
        project={project}
        projects={projects}
        menuProject={menuProject}
        exportProgress={exportProgress}
        setMenuProject={setMenuProject}
        openEditor={openProjectEditor}
        editDetails={openDetailsDialog}
        createSubmap={openSubmapDialog}
        expandMap={openExpandDialog}
        exportProject={openExportDialog}
        recoverProject={(target) => void recovery.open(target)}
        deleteProject={openDeleteDialog}
      />
    );
  };

  const editorController: ProjectEditorController = {
    dialog,
    submitting,
    selectedProject,
    projectName,
    projectPublicId,
    projectAuthor,
    projectDescription,
    projectCover,
    projectLoadingCover,
    mapSize,
    customMapSize,
    customSizeFeedback,
    releaseVersion: publisher.releaseVersion,
    releaseNotes: publisher.releaseNotes,
    assetMode: publisher.assetMode,
    assetConfig: publisher.assetConfig,
    savingAssetConfig: publisher.savingAssetConfig,
    dialogError,
    setDialog,
    setSubmitting,
    setDialogError,
    setProjectName,
    setProjectPublicId,
    setProjectAuthor,
    setProjectDescription,
    setProjectCover,
    setProjectLoadingCover,
    setMapSize,
    updateCustomMapSize,
    setReleaseVersion: publisher.setReleaseVersion,
    setReleaseNotes: publisher.setReleaseNotes,
    setAssetMode: publisher.setAssetMode,
    setAssetConfig: publisher.setAssetConfig,
    submitProject,
    saveAssetConfiguration: publisher.saveAssetConfiguration,
  };

  return (
    <main
      className={`${styles.page} boxWorkCenter creatorWorkCenter`}
      onClick={() => {
        setMenuProject(null);
      }}
    >
      <header className={styles.header}>
        <a className={styles.brand} href="/projects" aria-label="BOX Local Engine">
          <img className={styles.brandMark} src="/logo512.png" alt="" aria-hidden="true" />
          <span>BOX3 Engine</span>
        </a>
        <div className={styles.headerActions} onClick={(event) => event.stopPropagation()}>
          <IntlProvider locale="zh-CN" messages={zhMessages}>
            <PlayerAccount
              identity={creatorIdentity}
              onSave={saveCreatorProfile}
              onLogout={logoutCreator}
            />
          </IntlProvider>
        </div>
      </header>

      <section className={styles.content} aria-label="创作中心">
        <nav className={styles.workCenterTabs} aria-label="作品分类">
          <button
            type="button"
            aria-current={activeView === 'maps' ? 'page' : undefined}
            className={activeView === 'maps' ? styles.workCenterTabActive : undefined}
            onClick={() => void switchView('maps')}
          >
            <MapIcon size={17} />
            <strong>地图列表</strong>
          </button>
          <button
            type="button"
            aria-current={activeView === 'models' ? 'page' : undefined}
            className={activeView === 'models' ? styles.workCenterTabActive : undefined}
            onClick={() => void switchView('models')}
          >
            <Box size={17} />
            <strong>模型列表</strong>
          </button>
        </nav>

        {activeView === 'maps' ? (
          <ProjectCatalog
            catalog={catalog}
            notice={notice}
            importProgress={importProgress}
            importInputRef={importInputRef}
            chooseProjectFile={chooseProjectFile}
            openCreateDialog={openCreateDialog}
            renderProjectCard={renderProjectCard}
          />
        ) : (
          <CreatorModelLibrary
            voxaUrl={voxaUrl}
            canManageModels={creatorPermissions.includes('models.manage')}
          />
        )}
      </section>

      <ProjectImportChoiceDialog
        file={pendingImportFile}
        mode={importMode}
        targetMainId={importTargetMainId}
        mainProjects={mainProjects}
        close={() => setPendingImportFile(null)}
        setMode={setImportMode}
        setTargetMainId={setImportTargetMainId}
        confirm={confirmProjectImport}
      />
      <ProjectExportChoiceDialog
        project={exportChoiceProject}
        close={() => setExportChoiceProject(null)}
        exportProject={(project, scope) => void exportProjectFile(project, scope)}
        publishProject={(project) => {
          setExportChoiceProject(null);
          publisher.open(project);
        }}
      />
      <ProjectEditorDialog controller={editorController} />
      <ProjectRecoveryDialog
        project={recovery.project}
        snapshots={recovery.snapshots}
        selectedSnapshot={recovery.selectedSnapshot}
        loading={recovery.loading}
        error={recovery.error}
        close={recovery.close}
        select={recovery.select}
        restore={() => void recovery.restore()}
      />
      <ProjectProgressDialogs
        exportProgress={exportProgress}
        importProgress={importProgress}
        publishProgress={publisher.publishProgress}
        closeExport={() => setExportProgress(null)}
        closeImport={() => setImportProgress(null)}
        closePublish={() => publisher.setPublishProgress(null)}
      />
    </main>
  );
}

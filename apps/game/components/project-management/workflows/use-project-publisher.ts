import { useState } from 'react';

import { apiClient } from '../../../src/apis/client';
import { nextReleaseVersion } from '../project-presentation';
import type {
  AssetDistributionConfiguration,
  CompatibilityReport,
  LocalProject,
  PublishProgress,
} from '../project-types';

function isByteStream(value: unknown): value is ReadableStream<Uint8Array> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getReader' in value &&
    typeof value.getReader === 'function'
  );
}

type Options = {
  projects: LocalProject[];
  refreshProjects: () => Promise<void>;
  setNotice: (notice: string) => void;
  closeProjectMenu: () => void;
  selectProject: (project: LocalProject | null) => void;
  openPublishDialog: () => void;
  closeDialog: () => void;
  setDialogError: (error: string) => void;
  isSubmitting: () => boolean;
};

const emptyAssetConfig: AssetDistributionConfiguration = {
  endpoint: '',
  bucket: '',
  region: 'auto',
  accessKeyId: '',
  secretAccessKey: '',
  cdnBaseUrl: '',
  hasSecretAccessKey: false,
};

export function useProjectPublisher(options: Options) {
  const [releaseVersion, setReleaseVersion] = useState('v1.0.0');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [assetMode, setAssetMode] = useState<'local' | 'oss'>('local');
  const [assetConfig, setAssetConfig] = useState<AssetDistributionConfiguration>(emptyAssetConfig);
  const [savingAssetConfig, setSavingAssetConfig] = useState(false);
  const [publishProgress, setPublishProgress] = useState<PublishProgress | null>(null);

  const open = (project: LocalProject) => {
    options.closeProjectMenu();
    const mainProject = options.projects.find((entry) => entry.id === project.mainProjectId) || project;
    options.selectProject(mainProject);
    setReleaseVersion(nextReleaseVersion(mainProject.latestRelease));
    setReleaseNotes('');
    setAssetMode('local');
    options.setDialogError('');
    options.openPublishDialog();
    void apiClient
      .getApiLocalProjectsAssetDistribution()
      .then((data) => {
        setAssetConfig((current) => ({
          ...current,
          ...((data as { configuration?: Partial<AssetDistributionConfiguration> }).configuration || {}),
          secretAccessKey: '',
        }));
      })
      .catch((error) => options.setDialogError(error.message));
  };

  const persistAssetConfiguration = async () => {
    const data = (await apiClient.patchApiLocalProjectsAssetDistribution({
      body: assetConfig,
    })) as { configuration?: Partial<AssetDistributionConfiguration> };
    setAssetConfig((current) => ({
      ...current,
      ...(data.configuration || {}),
      secretAccessKey: '',
    }));
  };

  const saveAssetConfiguration = async () => {
    if (savingAssetConfig || options.isSubmitting()) return;
    setSavingAssetConfig(true);
    options.setDialogError('');
    try {
      await persistAssetConfiguration();
      options.setNotice('OSS 配置已保存到本机；尚未上传任何资源。');
    } catch (error) {
      options.setDialogError(error instanceof Error ? error.message : '无法保存 OSS 资源分发设置');
    } finally {
      setSavingAssetConfig(false);
    }
  };

  const publish = async (project: LocalProject) => {
    let publishedVersion = releaseVersion.trim();
    let compatibility: CompatibilityReport | undefined;
    const startedAt = Date.now();
    if (assetMode === 'oss') await persistAssetConfiguration();
    options.closeDialog();
    options.setNotice('');
    setPublishProgress({
      projectName: project.name,
      version: publishedVersion,
      phase: 'saving',
      percent: 5,
      received: 0,
      total: 0,
      elapsedSeconds: 0,
    });
    const timer = window.setInterval(() => {
      setPublishProgress((current) =>
        current && !['done', 'error'].includes(current.phase)
          ? {
              ...current,
              elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
              percent:
                current.phase === 'saving'
                  ? Math.min(18, current.percent + 0.35)
                  : current.phase === 'publishing'
                    ? Math.min(38, current.percent + 0.25)
                    : current.phase === 'packing'
                      ? Math.min(62, current.percent + 0.18)
                      : current.percent,
            }
          : current,
      );
    }, 500);
    const publishPhaseTimer = window.setTimeout(() => {
      setPublishProgress((current) =>
        current?.phase === 'saving'
          ? { ...current, phase: 'publishing', percent: Math.max(20, current.percent) }
          : current,
      );
    }, 1200);
    try {
      const data = (await apiClient.postApiLocalProjectsIdPublish({
        params: { path: { id: project.id } },
        body: { version: publishedVersion, notes: releaseNotes },
      })) as {
        release: {
          version: string;
          releases?: Array<{ compatibility?: CompatibilityReport }>;
        };
      };
      publishedVersion = data.release.version;
      const reports = Array.isArray(data.release.releases)
        ? (data.release.releases
            .map((release: { compatibility?: CompatibilityReport }) => release.compatibility)
            .filter(Boolean) as CompatibilityReport[])
        : [];
      compatibility = reports.length
        ? {
            level: reports.some((report) => report.level === 'error')
              ? 'error'
              : reports.some((report) => report.level === 'warning')
                ? 'warning'
                : 'compatible',
            summary: reports.reduce(
              (summary, report) => ({
                warnings: summary.warnings + report.summary.warnings,
                errors: summary.errors + report.summary.errors,
                missingBlobCount: summary.missingBlobCount + report.summary.missingBlobCount,
              }),
              { warnings: 0, errors: 0, missingBlobCount: 0 },
            ),
          }
        : undefined;
      setPublishProgress((current) =>
        current ? { ...current, phase: 'packing', percent: 42, version: publishedVersion } : current,
      );
      const packageResult = await apiClient.postApiLocalProjectsIdPackageRaw({
        params: { path: { id: project.id } },
        body: { version: publishedVersion, assetMode },
        parseAs: 'stream',
      });
      if (packageResult.error)
        throw new Error(packageResult.error.message || '导出游玩包失败');
      const packageResponse = packageResult.response;
      const disposition = packageResponse.headers.get('Content-Disposition') || '';
      const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      const filename = encodedName
        ? decodeURIComponent(encodedName)
        : `${project.name}_${project.id}_${publishedVersion}.boxplay`;
      const total = Number(packageResponse.headers.get('Content-Length') || 0);
      const mapCount = Number(packageResponse.headers.get('X-Box-Map-Count') || 1);
      let received = 0;
      const chunks: Uint8Array[] = [];
      setPublishProgress((current) =>
        current ? { ...current, phase: 'downloading', percent: 65, total, filename } : current,
      );
      if (packageResult.data != null) {
        if (!isByteStream(packageResult.data)) {
          throw new Error('打包服务返回了无效的文件流');
        }
        const reader = packageResult.data.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          chunks.push(value);
          received += value.byteLength;
          setPublishProgress((current) =>
            current
              ? {
                  ...current,
                  phase: 'downloading',
                  percent: total
                    ? 65 + Math.min(33, (received / total) * 33)
                    : Math.min(96, 65 + chunks.length),
                  received,
                  total,
                  elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
                  filename,
                }
              : current,
          );
        }
      } else {
        const value = new Uint8Array(await packageResponse.arrayBuffer());
        chunks.push(value);
        received = value.byteLength;
      }
      const blob = new Blob(chunks, { type: 'application/gzip' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPublishProgress({
        projectName: project.name,
        version: publishedVersion,
        phase: 'done',
        percent: 100,
        received: received || blob.size,
        total: total || blob.size,
        elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
        filename,
      });
      options.setNotice(
        compatibility && (compatibility.summary.warnings || compatibility.summary.errors)
          ? `游戏包 ${publishedVersion} 已导出，包含 ${mapCount} 张地图；兼容性检查发现 ${compatibility.summary.errors} 个错误、${compatibility.summary.warnings} 个提醒`
          : `游戏包 ${publishedVersion} 已导出，包含 ${mapCount} 张地图；兼容性检查通过`,
      );
      await options.refreshProjects();
    } catch (error) {
      setPublishProgress((current) => ({
        projectName: project.name,
        version: publishedVersion,
        phase: 'error',
        percent: current?.percent || 0,
        received: current?.received || 0,
        total: current?.total || 0,
        elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
        filename: current?.filename,
        message: error instanceof Error ? error.message : '导出游玩包失败',
      }));
    } finally {
      window.clearInterval(timer);
      window.clearTimeout(publishPhaseTimer);
    }
  };

  return {
    releaseVersion,
    releaseNotes,
    assetMode,
    assetConfig,
    savingAssetConfig,
    publishProgress,
    open,
    publish,
    saveAssetConfiguration,
    setReleaseVersion,
    setReleaseNotes,
    setAssetMode,
    setAssetConfig,
    setPublishProgress,
  };
}

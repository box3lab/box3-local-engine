import { useState } from 'react';
import { apiOperations } from '@box/apis';

import { apiClient } from '../../../src/apis/client';
import {
  compatibilityDiagnostics,
  importResponseError,
  type DetailedImportError,
  type ImportDiagnostic,
} from '../../../server/import-diagnostics';
import type { ExportProgress, ImportMode, ImportProgress, LocalProject, ProjectExportScope } from '../project-types';

function isByteStream(value: unknown): value is ReadableStream<Uint8Array> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getReader' in value &&
    typeof value.getReader === 'function'
  );
}

type Options = {
  mainProjects: LocalProject[];
  refreshProjects: () => Promise<void>;
  setNotice: (notice: string) => void;
  closeProjectMenu: () => void;
};

/** Owns project package import/export choices, transfer progress, and downloads. */
export function useProjectTransfer(options: Options) {
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('independent');
  const [importTargetMainId, setImportTargetMainId] = useState('');
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportChoiceProject, setExportChoiceProject] = useState<LocalProject | null>(null);

  const chooseProjectFile = (file: File) => {
    setPendingImportFile(file);
    setImportMode('independent');
    setImportTargetMainId(options.mainProjects[0]?.id || '');
  };

  const importProjectFile = async (file: File, mode: ImportMode, targetMainProjectId = '') => {
    if (importProgress && !['done', 'error'].includes(importProgress.phase)) return;
    options.setNotice('');
    const startedAt = Date.now();
    setImportProgress({ filename: file.name, phase: 'uploading', percent: 0, sent: 0, total: file.size, elapsedSeconds: 0 });
    const timer = window.setInterval(() => {
      setImportProgress((current) => current && ['uploading', 'processing'].includes(current.phase)
        ? { ...current, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) }
        : current);
    }, 500);
    try {
      const data = await new Promise<{ project?: LocalProject; message?: string; details?: ImportDiagnostic[] }>((resolve, reject) => {
        const request = new XMLHttpRequest();
        const parameters = new URLSearchParams({ mode });
        if (mode === 'submap') parameters.set('targetMainProjectId', targetMainProjectId);
        request.open(
          apiOperations.postApiLocalProjectsImport.method,
          `${apiOperations.postApiLocalProjectsImport.path}?${parameters.toString()}`,
        );
        request.setRequestHeader('Content-Type', 'application/octet-stream');
        request.upload.onprogress = (event) => {
          const total = event.lengthComputable ? event.total : file.size;
          const sent = event.loaded;
          setImportProgress((current) => current ? { ...current, phase: 'uploading', percent: total ? Math.min(70, (sent / total) * 70) : 0, sent, total, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) } : current);
        };
        request.upload.onload = () => setImportProgress((current) => current ? { ...current, phase: 'processing', percent: 75, sent: file.size, total: file.size, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) } : current);
        request.onerror = () => reject(new Error('无法连接创作端，工程包上传失败'));
        request.onabort = () => reject(new Error('导入已取消'));
        request.onload = () => {
          let result: { project?: LocalProject; message?: string; details?: ImportDiagnostic[] } = {};
          try { result = JSON.parse(request.responseText || '{}'); } catch { /* handled by status */ }
          if (request.status >= 200 && request.status < 300) resolve(result);
          else reject(importResponseError(result, request.status, '导入工程失败'));
        };
        request.send(file);
      });
      await options.refreshProjects();
      const report = data.project?.compatibility;
      setImportProgress({ filename: file.name, phase: 'done', percent: 100, sent: file.size, total: file.size, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000), projectName: data.project?.name, details: compatibilityDiagnostics(report) });
      const location = mode === 'submap'
        ? `，已成为“${options.mainProjects.find((project) => project.id === targetMainProjectId)?.name || targetMainProjectId}”的副地图`
        : '，原地图组主副关系已保留';
      options.setNotice(report && (report.summary.warnings || report.summary.errors)
        ? `工程已导入：${data.project?.name || file.name}${location}；兼容性检查发现 ${report.summary.errors} 个错误、${report.summary.warnings} 个提醒`
        : `工程已导入：${data.project?.name || file.name}${location}；兼容性检查通过`);
    } catch (error) {
      setImportProgress((current) => ({ filename: file.name, phase: 'error', percent: current?.percent || 0, sent: current?.sent || 0, total: current?.total || file.size, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000), message: error instanceof Error ? error.message : '导入工程失败', details: (error as Partial<DetailedImportError>)?.details || [] }));
    } finally {
      window.clearInterval(timer);
    }
  };

  const confirmProjectImport = () => {
    if (!pendingImportFile) return;
    if (importMode === 'submap' && !importTargetMainId) {
      options.setNotice('请先选择副地图所属的主地图');
      return;
    }
    const file = pendingImportFile;
    setPendingImportFile(null);
    void importProjectFile(file, importMode, importTargetMainId);
  };

  const openExportDialog = (project: LocalProject) => {
    options.closeProjectMenu();
    setExportChoiceProject(project);
  };

  const exportProjectFile = async (project: LocalProject, scope: ProjectExportScope) => {
    if (exportProgress && !['done', 'error'].includes(exportProgress.phase)) return;
    options.closeProjectMenu();
    setExportChoiceProject(null);
    options.setNotice('');
    const startedAt = Date.now();
    setExportProgress({ projectId: project.id, projectName: project.name, phase: 'packing', percent: 8, received: 0, total: 0, elapsedSeconds: 0 });
    const timer = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setExportProgress((current) => current?.projectId === project.id && current.phase === 'packing'
        ? { ...current, elapsedSeconds, percent: Math.min(30, 8 + elapsedSeconds * 0.6) }
        : current);
    }, 500);
    try {
      const result = await apiClient.getApiLocalProjectsIdExportRaw({
        params: { path: { id: project.id }, query: { scope } },
        parseAs: 'stream',
      });
      if (result.error) throw new Error(result.error.message || '导出工程失败');
      const response = result.response;
      const disposition = response.headers.get('Content-Disposition') || '';
      const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      const filename = encodedName ? decodeURIComponent(encodedName) : `${project.name}_${project.id}.boxproject`;
      const total = Number(response.headers.get('Content-Length') || 0);
      let received = 0;
      const chunks: Uint8Array[] = [];
      setExportProgress((current) => current ? { ...current, phase: 'downloading', percent: 35, total, filename } : current);
      if (result.data != null) {
        if (!isByteStream(result.data)) {
          throw new Error('工程导出服务返回了无效的文件流');
        }
        const reader = result.data.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          chunks.push(value);
          received += value.byteLength;
          const percent = total ? 35 + Math.min(60, (received / total) * 60) : Math.min(92, 35 + chunks.length);
          setExportProgress((current) => current ? { ...current, phase: 'downloading', percent, received, total, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000), filename } : current);
        }
      } else {
        const value = new Uint8Array(await response.arrayBuffer());
        chunks.push(value);
        received = value.byteLength;
      }
      const blob = new Blob(chunks, { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportProgress({ projectId: project.id, projectName: project.name, phase: 'done', percent: 100, received: received || blob.size, total: total || blob.size, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000), filename });
      options.setNotice(`${scope === 'map' ? '本地图工程' : '地图组工程'}已导出：${filename}`);
    } catch (error) {
      setExportProgress((current) => ({ projectId: project.id, projectName: project.name, phase: 'error', percent: current?.percent || 0, received: current?.received || 0, total: current?.total || 0, elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000), message: error instanceof Error ? error.message : '导出工程失败' }));
    } finally {
      window.clearInterval(timer);
    }
  };

  return {
    pendingImportFile, importMode, importTargetMainId, importProgress,
    exportProgress, exportChoiceProject, chooseProjectFile, confirmProjectImport,
    openExportDialog, exportProjectFile, setPendingImportFile, setImportMode,
    setImportTargetMainId, setImportProgress, setExportProgress, setExportChoiceProject,
  };
}

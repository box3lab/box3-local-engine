import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Clock3,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ServerOff,
  Shirt,
  Trash2,
  Upload,
} from 'lucide-react';

import { apiClient } from '../src/apis/client';
import styles from './creator-model-library.module.css';

type ModelTypeFilter = '全部' | '模型' | '皮肤';

type CreatorModel = {
  modelId: number;
  modelName: string;
  modelDescription: string;
  modelPreviewUrl: string;
  creativeMode: number;
  updatedAt: string;
};

type ServiceState = 'loading' | 'ready' | 'unavailable';

function modelKind(model: CreatorModel): Exclude<ModelTypeFilter, '全部'> {
  return model.creativeMode === 2 ? '皮肤' : '模型';
}

function formatUpdatedAt(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : '未知时间';
}

function editorHref(voxaUrl: string, model?: CreatorModel, editType?: 0 | 1) {
  const query = model
    ? `modelId=${model.modelId}&editType=${model.creativeMode === 2 ? 1 : 0}`
    : `modelType=0&editType=${editType || 0}`;
  return `${voxaUrl.replace(/\/$/, '')}/?${query}`;
}

export function CreatorModelLibrary({ voxaUrl, canManageModels }: {
  voxaUrl: string;
  canManageModels: boolean;
}) {
  const [models, setModels] = useState<CreatorModel[]>([]);
  const [serviceState, setServiceState] = useState<ServiceState>('loading');
  const [serviceMessage, setServiceMessage] = useState('正在连接模型服务…');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<ModelTypeFilter>('全部');
  const [menuModel, setMenuModel] = useState<number | null>(null);
  const [editingModel, setEditingModel] = useState<CreatorModel | null>(null);
  const [deletingModel, setDeletingModel] = useState<CreatorModel | null>(null);
  const [modelName, setModelName] = useState('');
  const [modelDescription, setModelDescription] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const refreshModels = useCallback(async (quiet = false) => {
    if (!quiet) {
      setServiceState('loading');
      setServiceMessage('正在连接模型服务…');
    }
    try {
      const data = (await apiClient.getApiCreatorModels({ cache: 'no-store' })) as {
        rows?: CreatorModel[];
      };
      setModels(Array.isArray(data.rows) ? data.rows : []);
      setServiceState('ready');
      setServiceMessage('模型服务运行正常');
    } catch (error) {
      setServiceState('unavailable');
      setServiceMessage((error as Error).message || '模型服务未启动');
    }
  }, []);

  useEffect(() => {
    if (!canManageModels) return;
    void refreshModels();
    const handleFocus = () => void refreshModels(true);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [canManageModels, refreshModels]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleModels = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('zh-CN');
    return models.filter((model) => (
      (type === '全部' || modelKind(model) === type) &&
      (!normalized || model.modelName.toLocaleLowerCase('zh-CN').includes(normalized))
    ));
  }, [models, query, type]);

  const openEditor = (model?: CreatorModel, editType?: 0 | 1) => {
    if (!canManageModels || serviceState !== 'ready' || !voxaUrl) return;
    window.open(editorHref(voxaUrl, model, editType), '_blank', 'noopener,noreferrer');
  };

  const importModel = async (file: File) => {
    if (submitting) return;
    setSubmitting(true);
    setNotice('正在导入模型工程…');
    try {
      const data = (await apiClient.postApiCreatorModelsImport({
        headers: { 'Content-Type': file.type || 'application/vnd.box.voxaproject+zip' },
        body: { file },
        bodySerializer: () => file,
      })) as { requiresResourceResave?: boolean; modelName?: string };
      setNotice(data.requiresResourceResave
        ? `已导入“${data.modelName || file.name}”。此旧工程未包含模型资源，请在 VOXA 中打开并保存一次后再放置。`
        : `已导入“${data.modelName || file.name}”`);
      await refreshModels(true);
    } catch (error) {
      setNotice((error as Error).message || '导入模型工程失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (model: CreatorModel) => {
    setMenuModel(null);
    setEditingModel(model);
    setModelName(model.modelName || '');
    setModelDescription(model.modelDescription || '');
    setDialogError('');
  };

  const saveModelInfo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingModel || submitting) return;
    if (!modelName.trim()) {
      setDialogError('请输入模型名称');
      return;
    }
    setSubmitting(true);
    setDialogError('');
    try {
      const updated = (await apiClient.putApiCreatorModelsId({
        params: { path: { id: String(editingModel.modelId) } },
        body: {
          modelName: modelName.trim(),
          modelDescription: modelDescription.trim(),
        },
      })) as Partial<CreatorModel>;
      setModels((items) => items.map((item) => item.modelId === editingModel.modelId
        // VOXA's update response contains model metadata but not Creator's
        // derived preview URL. Keep that local field until the next refresh.
        ? { ...item, ...updated, modelPreviewUrl: item.modelPreviewUrl }
        : item));
      setEditingModel(null);
      setNotice('模型信息已保存');
    } catch (error) {
      setDialogError((error as Error).message || '保存模型信息失败');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingModel || submitting) return;
    setSubmitting(true);
    setDialogError('');
    try {
      await apiClient.deleteApiCreatorModelsId({
        params: { path: { id: String(deletingModel.modelId) } },
      });
      setModels((items) => items.filter((item) => item.modelId !== deletingModel.modelId));
      setDeletingModel(null);
      setNotice('模型已删除');
    } catch (error) {
      setDialogError((error as Error).message || '删除模型失败');
    } finally {
      setSubmitting(false);
    }
  };

  const sectionHeader = <div className={`${styles.sectionHeader} creatorSectionHeader`}>
    <div className={`${styles.sectionSummary} creatorSectionSummary`}>
      <strong>模型作品</strong>
      <span>{serviceState === 'loading' ? '正在连接…' : `${models.length} 个模型与皮肤`}</span>
    </div>
    <div className={`${styles.sectionActions} creatorSectionActions`}>
      <button className={styles.secondaryButton} disabled={serviceState !== 'ready' || submitting} onClick={() => importInputRef.current?.click()}>
        <Upload size={16} />导入模型工程
      </button>
      <input
        ref={importInputRef}
        className={styles.hiddenInput}
        type="file"
        accept=".voxaproject,.voxa-project"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void importModel(file);
        }}
      />
      <button className={styles.secondaryButton} disabled={serviceState !== 'ready'} onClick={() => openEditor(undefined, 1)}>
        <Shirt size={16} />新建皮肤
      </button>
      <button className={styles.primaryButton} disabled={serviceState !== 'ready'} onClick={() => openEditor(undefined, 0)}>
        <Plus size={17} />新建模型
      </button>
    </div>
  </div>;

  if (!canManageModels) {
    return <section className={`${styles.library} creatorLibrary`}>
      <div className={styles.servicePanel} aria-live="polite">
        <div className={styles.serviceIcon}><ServerOff size={24} /></div>
        <div className={styles.serviceCopy}>
          <span className={styles.serviceLabel}>模型管理未授权</span>
          <h2>当前账号不能管理 VOXA 模型</h2>
          <p>地图仍可正常使用已有模型；如需导入、编辑或导出模型，请让服主授予“管理模型”权限。</p>
        </div>
      </div>
    </section>;
  }

  if (serviceState === 'unavailable') {
    return <section className={`${styles.library} creatorLibrary`}>
      {sectionHeader}
      <div className={styles.servicePanel} aria-live="polite">
        <div className={styles.serviceIcon}><ServerOff size={24} /></div>
        <div className={styles.serviceCopy}>
          <span className={styles.serviceLabel}>模型服务未运行</span>
          <h2>暂时无法读取模型列表</h2>
          <p>{serviceMessage}。</p>
        </div>
        <button className={styles.retryButton} type="button" onClick={() => void refreshModels()}>
          <RefreshCw size={16} />重新检测
        </button>
      </div>
    </section>;
  }

  return <section className={`${styles.library} creatorLibrary`} onClick={() => setMenuModel(null)}>
    {sectionHeader}

    {notice && <div className={`${styles.notice} creatorToast`} role="status">{notice}</div>}

    <div className={styles.toolbar}>
      <label className={styles.search}>
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模型或皮肤" />
      </label>
      <div className={`${styles.typeTabs} creatorFilterTabs`} aria-label="模型类型">
        {(['全部', '模型', '皮肤'] as const).map((option) => <button
          key={option}
          type="button"
          aria-pressed={type === option}
          className={type === option ? styles.typeTabActive : undefined}
          onClick={() => setType(option)}
        >{option}</button>)}
      </div>
      <span className={styles.count}>{visibleModels.length} 项</span>
    </div>

    {serviceState === 'loading' ? <div className={styles.loadingState}>
      <RefreshCw size={20} />正在读取模型列表…
    </div> : visibleModels.length ? <div className={styles.grid}>
      {visibleModels.map((model) => <article className={styles.card} key={model.modelId}>
        <button className={styles.cardLink} aria-label={`编辑${model.modelName}`} onClick={() => openEditor(model)} />
        <div className={styles.preview}>
          {model.modelPreviewUrl
            ? <img src={model.modelPreviewUrl} alt="" />
            : modelKind(model) === '皮肤' ? <Shirt size={38} /> : <Box size={38} />}
          <span>{modelKind(model)}</span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.cardHeading}>
            <h2>{model.modelName || `未命名${modelKind(model)}`}</h2>
            <p>{model.modelDescription || `模型 ID ${model.modelId}`}</p>
          </div>
          <div className={styles.cardFooter}>
            <time dateTime={model.updatedAt}><Clock3 size={13} />{formatUpdatedAt(model.updatedAt)}</time>
          </div>
        </div>
        <div className={styles.menuWrap} onClick={(event) => event.stopPropagation()}>
          <button
            className={styles.moreButton}
            aria-label="更多操作"
            aria-expanded={menuModel === model.modelId}
            onClick={() => setMenuModel(menuModel === model.modelId ? null : model.modelId)}
          >
            <MoreHorizontal size={18} />
          </button>
          {menuModel === model.modelId && <div className={styles.menu}>
            <button onClick={() => openEditDialog(model)}><Pencil size={14} />修改信息</button>
            <a href={`/api/creator-models/${model.modelId}/export`} download><Download size={14} />导出工程</a>
            <button className={styles.deleteAction} onClick={() => { setDeletingModel(model); setDialogError(''); setMenuModel(null); }}><Trash2 size={14} />删除</button>
          </div>}
        </div>
      </article>)}
    </div> : <div className={styles.emptyState}>
      <span><Box size={24} /></span>
      <h2>{query || type !== '全部' ? '没有找到匹配内容' : '还没有模型'}</h2>
      <p>{query || type !== '全部' ? '换个关键词或清除筛选后再试。' : '创建模型后，它会显示在这里，也可以放入地图成为项目模型。'}</p>
      {(query || type !== '全部') && <button onClick={() => { setQuery(''); setType('全部'); }}>清除筛选</button>}
    </div>}

    {editingModel && <div className={styles.dialogBackdrop} onMouseDown={() => !submitting && setEditingModel(null)}>
      <form className={`${styles.dialog} ${styles.editDialog}`} onSubmit={saveModelInfo} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.dialogHeading}>
          <span className={styles.dialogIcon}><Pencil size={20} /></span>
          <h2>修改模型信息</h2>
        </div>
        <label htmlFor="creator-model-name">模型名称</label>
        <input id="creator-model-name" autoFocus maxLength={100} value={modelName} onChange={(event) => setModelName(event.target.value)} />
        <label htmlFor="creator-model-description">模型简介</label>
        <textarea id="creator-model-description" maxLength={500} rows={4} value={modelDescription} onChange={(event) => setModelDescription(event.target.value)} />
        {dialogError && <p className={styles.dialogError}>{dialogError}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.cancelButton} disabled={submitting} onClick={() => setEditingModel(null)}>取消</button>
          <button type="submit" className={styles.saveButton} disabled={submitting}>{submitting ? '保存中…' : '保存'}</button>
        </div>
      </form>
    </div>}

    {deletingModel && <div className={styles.dialogBackdrop} onMouseDown={() => !submitting && setDeletingModel(null)}>
      <section className={styles.dialog} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <span className={`${styles.dialogIcon} ${styles.deleteIcon}`}><Trash2 size={20} /></span>
        <h2>删除模型</h2>
        <p>确定删除“{deletingModel.modelName}”吗？已放入地图的项目模型不会被同时删除。</p>
        {dialogError && <p className={styles.dialogError}>{dialogError}</p>}
        <div className={styles.dialogActions}>
          <button className={styles.cancelButton} disabled={submitting} onClick={() => setDeletingModel(null)}>取消</button>
          <button className={styles.deleteButton} disabled={submitting} onClick={() => void confirmDelete()}>{submitting ? '删除中…' : '删除'}</button>
        </div>
      </section>
    </div>}
  </section>;
}

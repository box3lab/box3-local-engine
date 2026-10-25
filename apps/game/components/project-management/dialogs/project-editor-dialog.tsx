import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Grid2X2, Upload } from 'lucide-react';

import defaultLoadingCover from '../../../assets/banner.jpg';
import styles from '../../../pages/projects/projects.module.css';
import { defaultMapCover, mapSizeOptions, readProjectImage } from '../project-fixtures';
import { customMapSizeMessage } from '../project-presentation';
import type { AssetDistributionConfiguration, LocalProject, MapSizeChoice } from '../project-types';
import { AssetDistributionFields } from './asset-distribution-fields';

export type ProjectDialogKind = 'create' | 'submap' | 'expand' | 'delete' | 'details' | 'publish';

export type ProjectEditorController = {
  dialog: ProjectDialogKind | null;
  submitting: boolean;
  selectedProject: LocalProject | null;
  projectName: string;
  projectPublicId: string;
  projectAuthor: string;
  projectDescription: string;
  projectCover: string;
  projectLoadingCover: string;
  mapSize: MapSizeChoice;
  customMapSize: [number, number, number];
  customSizeFeedback: ReturnType<typeof customMapSizeMessage> | null;
  releaseVersion: string;
  releaseNotes: string;
  assetMode: 'local' | 'oss';
  assetConfig: AssetDistributionConfiguration;
  savingAssetConfig: boolean;
  dialogError: string;
  setDialog: (dialog: ProjectDialogKind | null) => void;
  setSubmitting: (value: boolean) => void;
  setDialogError: (value: string) => void;
  setProjectName: (value: string) => void;
  setProjectPublicId: (value: string) => void;
  setProjectAuthor: (value: string) => void;
  setProjectDescription: (value: string) => void;
  setProjectCover: (value: string) => void;
  setProjectLoadingCover: (value: string) => void;
  setMapSize: (value: MapSizeChoice) => void;
  updateCustomMapSize: (index: 0 | 1 | 2, value: string) => void;
  setReleaseVersion: (value: string) => void;
  setReleaseNotes: (value: string) => void;
  setAssetMode: (value: 'local' | 'oss') => void;
  setAssetConfig: Dispatch<SetStateAction<AssetDistributionConfiguration>>;
  submitProject: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  saveAssetConfiguration: () => Promise<void>;
};

export function ProjectEditorDialog({ controller: c }: { controller: ProjectEditorController }) {
  const {
    dialog, submitting, selectedProject, projectName, projectPublicId, projectAuthor,
    projectDescription, projectCover, projectLoadingCover, mapSize, customMapSize,
    customSizeFeedback, releaseVersion, releaseNotes, assetMode, assetConfig,
    savingAssetConfig, dialogError, setDialog, setSubmitting, setDialogError,
    setProjectName, setProjectPublicId, setProjectAuthor, setProjectDescription,
    setProjectCover, setProjectLoadingCover, setMapSize, updateCustomMapSize,
    setReleaseVersion, setReleaseNotes, setAssetMode, setAssetConfig, submitProject,
    saveAssetConfiguration,
  } = c;
  return (
    <>
      {dialog && (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onMouseDown={() => {
            if (!submitting) setDialog(null);
          }}
        >
          <form
            className={`${styles.dialog} ${dialog === 'publish' ? styles.releaseDialog : ''} ${dialog === 'details' ? styles.detailsDialog : ''}`}
            onSubmit={(event) => {
              if (submitting) {
                event.preventDefault();
                return;
              }
              setSubmitting(true);
              submitProject(event)
                .catch((error) => setDialogError(error.message))
                .finally(() => setSubmitting(false));
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.dialogHeading}>
              <div className={styles.dialogIcon}>
                <Grid2X2 size={22} />
              </div>
              <div>
                <h2>
                  {dialog === 'create'
                    ? '新建地图组'
                    : dialog === 'submap'
                      ? '创建副地图'
                      : dialog === 'expand'
                        ? '扩大地图'
                        : dialog === 'details'
                          ? '编辑信息'
                          : dialog === 'delete'
                            ? '删除作品'
                            : '导出游戏包'}
                </h2>
              </div>
            </div>
            {dialog === 'delete' && (
              <p>
                {selectedProject?.mapRole === 'main'
                  ? `将删除整个地图组“${selectedProject?.name}”及其全部副地图，删除后无法恢复。`
                  : `将删除副地图“${selectedProject?.name}”，删除后无法恢复。`}
              </p>
            )}
            {(dialog === 'create' || dialog === 'submap' || dialog === 'details') && (
              <>
                <div className={styles.dialogFields}>
                  {dialog === 'details' && <div className={styles.detailsSectionTitle}>基本资料</div>}
                  <div className={styles.fieldGroup}>
                    <label htmlFor="project-name">作品名称</label>
                    <input
                      id="project-name"
                      autoFocus
                      maxLength={40}
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      placeholder="例如：我的冒险世界"
                    />
                  </div>
                  {(dialog === 'create' || dialog === 'submap') && (
                    <>
                      <div className={styles.mapSizeField}>
                        <div className={styles.mapChoiceLabel}>
                          <label>地图尺寸</label>
                          <span>宽 × 高 × 长</span>
                        </div>
                        <div
                          className={styles.mapSizeOptions}
                          role="radiogroup"
                          aria-label="地图尺寸"
                        >
                          {mapSizeOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              role="radio"
                              aria-checked={mapSize === option.id}
                              className={
                                mapSize === option.id ? styles.mapChoiceSelected : undefined
                              }
                              onClick={() => setMapSize(option.id)}
                            >
                              <strong>{option.label}</strong>
                              <small>{option.dimensions}</small>
                            </button>
                          ))}
                          <button
                            type="button"
                            role="radio"
                            aria-checked={mapSize === 'custom'}
                            className={mapSize === 'custom' ? styles.mapChoiceSelected : undefined}
                            onClick={() => setMapSize('custom')}
                          >
                            <strong>自定义</strong>
                            <small>自行设置</small>
                          </button>
                        </div>
                        {mapSize === 'custom' && customSizeFeedback && (
                          <div className={styles.customMapSize}>
                            <div className={styles.customMapSizeGrid}>
                              <label>
                                宽
                                <input
                                  type="number"
                                  min={16}
                                  max={1024}
                                  step={16}
                                  value={customMapSize[0]}
                                  onChange={(event) => updateCustomMapSize(0, event.target.value)}
                                />
                              </label>
                              <label>
                                高
                                <input
                                  type="number"
                                  min={16}
                                  max={128}
                                  step={16}
                                  value={customMapSize[1]}
                                  onChange={(event) => updateCustomMapSize(1, event.target.value)}
                                />
                              </label>
                              <label>
                                长
                                <input
                                  type="number"
                                  min={16}
                                  max={1024}
                                  step={16}
                                  value={customMapSize[2]}
                                  onChange={(event) => updateCustomMapSize(2, event.target.value)}
                                />
                              </label>
                            </div>
                            <p
                              className={`${styles.customMapSizeHint} ${styles[`customMapSizeHint${customSizeFeedback.level}`]}`}
                            >
                              {customSizeFeedback.text}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {(dialog === 'create' ||
                    (dialog === 'details' && selectedProject?.mapRole !== 'submap')) && (
                    <div className={`${styles.fieldGroup} ${dialog === 'details' ? styles.detailsAuthorField : ''}`}>
                      <label htmlFor="project-author">作者</label>
                      <input
                        id="project-author"
                        maxLength={80}
                        value={projectAuthor}
                        onChange={(event) => setProjectAuthor(event.target.value)}
                        placeholder="填写地图作者"
                      />
                    </div>
                  )}
                  <div className={`${styles.fieldGroup} ${dialog === 'details' ? styles.detailsDescriptionField : ''}`}>
                    <label htmlFor="project-description">简介</label>
                    <textarea
                      id="project-description"
                      maxLength={300}
                      value={projectDescription}
                      onChange={(event) => setProjectDescription(event.target.value)}
                      placeholder="简单介绍这张地图"
                    />
                    <small className={styles.characterCount}>
                      {projectDescription.length} / 300
                    </small>
                  </div>
                  {dialog === 'details' && (
                    <>
                      <div className={styles.detailsSection}>
                        <div className={styles.detailsSectionTitle}>地图标识</div>
                        <div className={styles.detailsIdentityGrid}>
                          <div className={styles.fieldGroup}>
                            <label htmlFor="project-permanent-map-id">地图 ID</label>
                            <input
                              id="project-permanent-map-id"
                              value={selectedProject?.permanentMapId || ''}
                              readOnly
                              aria-readonly="true"
                            />
                          </div>
                          <div className={styles.fieldGroup}>
                            <label htmlFor="project-public-id">访问 ID</label>
                            <input
                              id="project-public-id"
                              maxLength={63}
                              spellCheck={false}
                              value={projectPublicId}
                              onChange={(event) =>
                                setProjectPublicId(
                                  event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                                )
                              }
                              placeholder="例如：my-adventure"
                            />
                          </div>
                        </div>
                      </div>
                      <div className={styles.detailsSection}>
                        <div className={styles.detailsSectionTitle}>展示素材</div>
                        <div className={styles.detailsCoverGrid}>
                          <div className={styles.fieldGroup}>
                            <label htmlFor="project-cover">作品封面</label>
                            <div className={`${styles.coverPickerRow} ${styles.coverPickerRowSquare}`}>
                              <div className={`${styles.coverPreview} ${styles.coverPreviewSquare}`}>
                                <img
                                  src={projectCover || defaultMapCover()}
                                  alt={projectCover ? '当前作品封面' : '默认作品封面'}
                                />
                              </div>
                              <label className={styles.coverPicker} htmlFor="project-cover">
                                <Upload size={17} aria-hidden="true" />
                                <span>
                                  <strong>{projectCover ? '更换作品封面' : '选择作品封面'}</strong>
                                  <small>1:1 · PNG、JPG 或 WebP · 最大 3MB</small>
                                </span>
                              </label>
                              <input
                                className={styles.coverFileInput}
                                id="project-cover"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  event.currentTarget.value = '';
                                  if (!file) return;
                                  void readProjectImage(file, '作品封面', 1)
                                    .then((image) => {
                                      setProjectCover(image);
                                      setDialogError('');
                                    })
                                    .catch((error) => setDialogError(error.message));
                                }}
                              />
                            </div>
                          </div>
                          <div className={styles.fieldGroup}>
                            <label htmlFor="project-loading-cover">封面图</label>
                            <div className={`${styles.coverPickerRow} ${styles.coverPickerRowWide}`}>
                              <div className={`${styles.coverPreview} ${styles.coverPreviewWide}`}>
                                <img
                                  src={projectLoadingCover || defaultLoadingCover.src}
                                  alt={projectLoadingCover ? '当前加载封面图' : '默认加载封面图'}
                                />
                              </div>
                              <label className={styles.coverPicker} htmlFor="project-loading-cover">
                                <Upload size={17} aria-hidden="true" />
                                <span>
                                  <strong>{projectLoadingCover ? '更换封面图' : '选择封面图'}</strong>
                                  <small>16:9 · 进入地图时展示 · 最大 3MB</small>
                                </span>
                              </label>
                              <input
                                className={styles.coverFileInput}
                                id="project-loading-cover"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  event.currentTarget.value = '';
                                  if (!file) return;
                                  void readProjectImage(file, '封面图', 16 / 9)
                                    .then((image) => {
                                      setProjectLoadingCover(image);
                                      setDialogError('');
                                    })
                                    .catch((error) => setDialogError(error.message));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {dialog === 'submap' && (
                  <p>副地图拥有独立地形和实体，并归属于“{selectedProject?.name}”地图组。</p>
                )}
              </>
            )}
            {dialog === 'expand' && (
              <div className={styles.dialogFields}>
                <p>
                  将地图扩大到指定尺寸，原地图会保留在原坐标，新增加的区域为空气。扩容前会自动创建恢复快照；此操作会保存并重载地图，请先停止正在运行的地图。
                </p>
                {submitting && (
                  <p role="status">
                    正在准备编辑运行时并保存地图区块，较大的地图可能需要几分钟……
                  </p>
                )}
                <div className={styles.customMapSize}>
                  <div className={styles.mapChoiceLabel}>
                    <label>目标尺寸</label>
                    <span>宽 × 高 × 长</span>
                  </div>
                  <div className={styles.customMapSizeGrid}>
                    <label>
                      宽
                      <input
                        type="number"
                        min={16}
                        max={1024}
                        step={16}
                        value={customMapSize[0]}
                        onChange={(event) => updateCustomMapSize(0, event.target.value)}
                      />
                    </label>
                    <label>
                      高
                      <input
                        type="number"
                        min={16}
                        max={128}
                        step={16}
                        value={customMapSize[1]}
                        onChange={(event) => updateCustomMapSize(1, event.target.value)}
                      />
                    </label>
                    <label>
                      长
                      <input
                        type="number"
                        min={16}
                        max={1024}
                        step={16}
                        value={customMapSize[2]}
                        onChange={(event) => updateCustomMapSize(2, event.target.value)}
                      />
                    </label>
                  </div>
                  {customSizeFeedback && (
                    <p
                      className={`${styles.customMapSizeHint} ${styles[`customMapSizeHint${customSizeFeedback.level}`]}`}
                    >
                      {customSizeFeedback.text} 每个方向都不能小于当前地图。
                    </p>
                  )}
                </div>
              </div>
            )}
            {dialog === 'publish' && (
              <>
                <p>主地图和全部副地图将使用同一版本号，合并为一个可一次导入游玩端的游戏包。每次导出会创建不可变版本，请使用新的版本号。</p>
                <label htmlFor="release-version">版本号</label>
                <input
                  id="release-version"
                  autoFocus
                  value={releaseVersion}
                  onChange={(event) => setReleaseVersion(event.target.value)}
                  placeholder="v1.0.0"
                />
                <label htmlFor="release-notes">更新说明</label>
                <textarea
                  id="release-notes"
                  maxLength={500}
                  value={releaseNotes}
                  onChange={(event) => setReleaseNotes(event.target.value)}
                />
                <div
                  className={styles.assetModeOptions}
                  role="radiogroup"
                  aria-label="资源发布方式"
                >
                  <label className={assetMode === 'local' ? styles.assetModeSelected : undefined}>
                    <input
                      type="radio"
                      name="asset-mode"
                      checked={assetMode === 'local'}
                      onChange={() => setAssetMode('local')}
                    />
                    <span>
                      <strong>仅本地资源</strong>
                      <small>包最大，但完全离线。</small>
                    </span>
                  </label>
                  <label className={assetMode === 'oss' ? styles.assetModeSelected : undefined}>
                    <input
                      type="radio"
                      name="asset-mode"
                      checked={assetMode === 'oss'}
                      onChange={() => setAssetMode('oss')}
                    />
                    <span>
                      <strong>仅引用 OSS</strong>
                      <small>包最小、加载最快；请勿删除已上传资源。</small>
                    </span>
                  </label>
                </div>
                {assetMode === 'oss' ? (
                  <AssetDistributionFields
                    configuration={assetConfig}
                    saving={savingAssetConfig}
                    submitting={submitting}
                    setConfiguration={setAssetConfig}
                    save={saveAssetConfiguration}
                  />
                ) : null}
              </>
            )}
            {dialogError && (
              <p className={styles.dialogError} role="alert">
                {dialogError}
              </p>
            )}
            <div className={styles.dialogActions}>
              <button type="button" className={styles.cancelButton} onClick={() => setDialog(null)}>
                取消
              </button>
              <button
                type="submit"
                className={dialog === 'delete' ? styles.deleteConfirm : styles.confirmButton}
                disabled={
                  submitting ||
                  (dialog === 'create' || dialog === 'submap' || dialog === 'details'
                    ? !projectName.trim() || (dialog === 'details' && !projectPublicId.trim())
                    : dialog === 'publish'
                      ? !releaseVersion.trim()
                      : dialog === 'expand'
                        ? !customSizeFeedback || customSizeFeedback.level === 'error'
                        : false)
                }
              >
                {submitting
                  ? '处理中…'
                  : dialog === 'create'
                    ? '创建地图组'
                    : dialog === 'submap'
                      ? '创建副地图'
                      : dialog === 'details'
                        ? '保存'
                        : dialog === 'delete'
                          ? '删除'
                          : dialog === 'expand'
                            ? '确认扩容并保存'
                            : '开始导出'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

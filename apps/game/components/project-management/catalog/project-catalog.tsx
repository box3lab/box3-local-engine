import type { ChangeEvent, ReactNode, RefObject } from 'react';
import { FolderOpen, Plus, Search, Upload } from 'lucide-react';

import styles from '../../../pages/projects/projects.module.css';
import type { ImportProgress, LocalProject } from '../project-types';
import type { ProjectCatalogController } from './use-project-catalog';

type Props = {
  catalog: ProjectCatalogController;
  notice: string;
  importProgress: ImportProgress | null;
  importInputRef: RefObject<HTMLInputElement | null>;
  chooseProjectFile: (file: File) => void;
  openCreateDialog: () => void;
  renderProjectCard: (project: LocalProject) => ReactNode;
};

export function ProjectCatalog({
  catalog,
  notice,
  importProgress,
  importInputRef,
  chooseProjectFile,
  openCreateDialog,
  renderProjectCard,
}: Props) {
  const chooseImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (file) chooseProjectFile(file);
  };

  return (
    <>
      <div className={`${styles.sectionHeader} creatorSectionHeader`}>
        <div className={`${styles.sectionSummary} creatorSectionSummary`}>
          <strong>地图作品</strong>
          <span>{catalog.projects.length} 个地图</span>
        </div>
        <div className={`${styles.sectionActions} creatorSectionActions`}>
          <button
            className={styles.importButton}
            disabled={Boolean(
              importProgress &&
                importProgress.phase !== 'done' &&
                importProgress.phase !== 'error',
            )}
            onClick={() => importInputRef.current?.click()}
          >
            <Upload size={16} /> 导入工程
          </button>
          <input
            ref={importInputRef}
            className={styles.hiddenFileInput}
            type="file"
            accept=".boxproject,.tar.gz,application/gzip"
            onChange={chooseImport}
          />
          <button className={styles.createButton} onClick={openCreateDialog}>
            <Plus size={18} strokeWidth={2.5} />
            新建作品
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={18} aria-hidden="true" />
          <input
            value={catalog.query}
            onChange={(event) => catalog.setQuery(event.target.value)}
            placeholder="搜索作品"
            aria-label="搜索作品"
          />
        </label>
        <div className="creatorFilterTabs" aria-label="作品状态">
          {(['全部', '草稿', '已发布'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={catalog.status === option}
              onClick={() => catalog.setStatus(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {notice && <div className={`${styles.notice} creatorToast`} role="status">{notice}</div>}
      {catalog.visibleProjects.length ? (
        <div className={styles.mapCategories}>
          {catalog.singleMapProjects.length > 0 && (
            <section className={styles.mapCategory} aria-labelledby="single-maps-title">
              <header className={styles.mapCategoryHeader}>
                <strong id="single-maps-title">单地图</strong>
                <span>{catalog.singleMapProjects.length} 张地图</span>
              </header>
              <div className={styles.grid}>
                {catalog.singleMapProjects.map(renderProjectCard)}
              </div>
            </section>
          )}
          {catalog.multiMapGroups.length > 0 && (
            <section className={styles.mapCategory} aria-labelledby="map-groups-title">
              <header className={styles.mapCategoryHeader}>
                <strong id="map-groups-title">地图组</strong>
                <span>{catalog.multiMapGroups.length} 个地图组</span>
              </header>
              <div className={styles.mapGroupList}>
                {catalog.multiMapGroups.map((group) => {
                  const submaps = group.projects.filter((project) => project.mapRole === 'submap');
                  return (
                    <section className={styles.mapGroupOverview} key={group.main.id}>
                      <div className={styles.mapGroupOverviewHead}>
                        {renderProjectCard(group.main)}
                        <div className={styles.mapGroupSubmaps}>
                          <div className={styles.mapGroupSubmapsHeader}>
                            <strong>副地图</strong>
                            <span>{group.submapCount} 张</span>
                          </div>
                          <div className={styles.mapGroupMiniGrid}>
                            {submaps.map(renderProjectCard)}
                          </div>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div><FolderOpen size={26} /></div>
          <h2>{catalog.isFiltering ? '没有找到匹配作品' : '还没有作品'}</h2>
          {catalog.isFiltering && (
            <button className={styles.secondaryButton} onClick={catalog.clearFilters}>
              清除筛选
            </button>
          )}
        </div>
      )}
    </>
  );
}

import { Clock3, Download, Expand, History, Pencil, Plus, Trash2 } from 'lucide-react';

import styles from '../../../pages/projects/projects.module.css';
import { defaultMapCover } from '../project-fixtures';
import { formatProjectUpdatedAt } from '../project-presentation';
import type { ExportProgress, LocalProject } from '../project-types';

type Props = {
  project: LocalProject;
  projects: LocalProject[];
  menuProject: string | null;
  exportProgress: ExportProgress | null;
  setMenuProject: (id: string | null) => void;
  openEditor: (project: LocalProject) => void;
  editDetails: (project: LocalProject) => void;
  createSubmap: (project: LocalProject) => void;
  expandMap: (project: LocalProject) => void;
  exportProject: (project: LocalProject) => void;
  recoverProject: (project: LocalProject) => void;
  deleteProject: (project: LocalProject) => void;
};

/** One project card, including its contextual actions and parent-map context. */
export function ProjectCard(props: Props) {
  const { project } = props;
  const mainProject = project.mapRole === 'submap'
    ? props.projects.find((entry) => entry.id === project.mainProjectId)
    : null;
  const menuOpen = props.menuProject === project.id;
  const exporting = Boolean(
    props.exportProgress
      && props.exportProgress.phase !== 'done'
      && props.exportProgress.phase !== 'error',
  );
  return (
    <article className={`${styles.card} ${project.mapRole === 'submap' ? styles.submapCard : styles.mainMapCard} ${menuOpen ? styles.cardMenuOpen : ''}`}>
      <button type="button" className={styles.cardLink} aria-label={`编辑地图 ${project.name}`} onClick={() => props.openEditor(project)} />
      <div className={`${styles.cover} ${styles[`cover${project.theme}`]}`}>
        <img className={project.cover ? undefined : styles.templateCover} src={project.cover || defaultMapCover()} alt="" />
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardHeading}>
          <div>
            <div className={styles.projectTitle}><h2>{project.name}</h2></div>
            {mainProject ? <span className={styles.projectParent}>属于 {mainProject.name}</span> : null}
            <span className={styles.projectAuthor}>作者：{project.author || '未署名'}</span>
            <p>{project.description || '未填写简介'}</p>
          </div>
          <div className={styles.menuWrap} onClick={(event) => event.stopPropagation()}>
            <button
              className={styles.moreButton}
              onClick={() => props.setMenuProject(menuOpen ? null : project.id)}
              aria-label={`${project.name} 的更多操作`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className={styles.menuDots} aria-hidden="true"><i /><i /><i /></span>
            </button>
            {menuOpen ? (
              <div className={styles.menu} role="menu">
                <button role="menuitem" onClick={() => props.editDetails(project)}><Pencil size={15} /> 编辑信息</button>
                {project.mapRole === 'main' ? <button role="menuitem" onClick={() => props.createSubmap(project)}><Plus size={15} /> 新建副地图</button> : null}
                <button role="menuitem" onClick={() => props.expandMap(project)}><Expand size={15} /> 扩大地图</button>
                <button role="menuitem" disabled={exporting} onClick={() => props.exportProject(project)}><Download size={15} /> 导出</button>
                <button role="menuitem" onClick={() => props.recoverProject(project)}><History size={15} /> 恢复历史版本</button>
                <button
                  role="menuitem"
                  className={styles.deleteAction}
                  disabled={project.isEngineWorld}
                  title={project.isEngineWorld ? '默认世界不能删除' : undefined}
                  onClick={() => props.deleteProject(project)}
                >
                  <Trash2 size={15} /> 删除
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className={styles.cardFooter}>
          <span><Clock3 size={14} /> {project.latestRelease ? `${project.latestRelease}${project.latestReleaseNotes ? ` · ${project.latestReleaseNotes}` : ''}` : formatProjectUpdatedAt(project.updatedAt)}</span>
          {project.isEngineWorld ? <span className={styles.cardActions}><span className={styles.defaultTag}>默认世界</span></span> : null}
        </div>
      </div>
    </article>
  );
}

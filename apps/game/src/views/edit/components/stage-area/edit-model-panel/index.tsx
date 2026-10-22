import * as React from 'react';
import { ReactNode, useMemo, useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { ProjectModelPanel } from './project';
import { PublicModelPanel } from './public';
import { PrivateModelPanel } from './private';
import { calc_class_name } from 'src/utils/classname';
import { CreativeMode, ModelType, REQUEST_TIMEOUT, SortOrder } from '@box/apis';
import { apis } from 'src/apis/local-api';
import { clientConfig } from 'src/config/client';
import { editor } from 'src/client/edit/edit-client';
import { getLibraryMapId } from 'src/utils/local-voxa-library';
import Preview from 'src/views/edit/components/stage-area/edit-model-panel/preview';

import style from './index.module.scss';
import { useEdit } from 'src/client/edit/edit-context';
import { Collapse } from 'src/views/components/collapse';

type TabItemType = {
  title: string;
  key: ModelPanelTab;
  content: ReactNode;
};

export type ModelPanelTab = ModelType | 'local';

export type ModelData = {
  id: number;
  name: string;
  modelPreviewUrl: string;
  modelFileHash: string;
  bounds: [number, number, number];
  animated: boolean;
  type: ModelType;
  updateAt: string;
  meshPath?: string;
  libraryScope?: 'local' | 'project';
};

export enum ModelAction {
  Edit = 'Edit',
  Open = 'Open',
  Rename = 'Rename',
  Copy = 'Copy',
  Remove = 'Remove',
}

/** 每次请求模型数据数量（每一页的模型数量）*/
export const FETCH_LIMIT = 16;

/**
 * 仅用于获取个人和公共模型列表
 * */
export async function fetchModelList(query: {
  modelType: ModelType;
  modelName?: string;
  offset?: number;
  limit?: number;
}): Promise<ModelData[] | undefined> {
  const { modelType, modelName, offset, limit = FETCH_LIMIT } = query;
  try {
    const res = await apis.models.getModelsUsingGetV2(
      {
        modelType,
        offset,
        limit,
        modelName,
        mapId: getLibraryMapId(
          clientConfig.isLocalGameServer,
          clientConfig.mapInfo.contentId,
        ),
        creativeMode: CreativeMode.Model,
        orderBy: SortOrder.ModifyTimeDesc,
      },
      {
        timeout: REQUEST_TIMEOUT,
      },
    );
    const modelListRes = res.rows;
    let modelList: ModelData[] = [];
    for (let i = 0; i < modelListRes.length; i++) {
      const model = modelListRes[i];
      const item: ModelData = {
        id: model.modelId,
        name: model.modelName,
        modelPreviewUrl: model.modelPreviewUrl || '',
        modelFileHash: model.modelFileHash || '',
        bounds: [0, 0, 0],
        animated: model.animated ?? false,
        type: modelType,
        updateAt: model.updatedAt || '',
      };
      modelList.push(item);
    }
    return modelList;
  } catch (e) {
    editor.logger.error(`error fetching ${modelType} model: ${e}`);
  }
  return;
}

export const EditModelPanelContainer = () => {
  const intl = useIntl();
  const editor = useEdit();
  const [currentTab, setCurrentTab] = useState<ModelPanelTab>(
    clientConfig.isLocalGameServer ? 'local' : ModelType.Project,
  );
  useEffect(() => {
    if (!clientConfig.isLocalGameServer) editor.replica.updateExtraProject();
  }, [editor]);
  const [collapsed, setCollapsed] = useState(false);

  const tabs: TabItemType[] = useMemo(() => {
    if (clientConfig.isLocalGameServer) {
      return [
        {
          title: intl.formatMessage({ id: 'local' }),
          key: 'local' as const,
          content: <ProjectModelPanel currentTab={currentTab} source="local" />,
        },
        {
          title: intl.formatMessage({ id: 'project' }),
          key: ModelType.Project,
          content: <ProjectModelPanel currentTab={currentTab} source="project" />,
        },
      ];
    }
    return [
      {
        title: intl.formatMessage({ id: 'project' }),
        key: ModelType.Project,
        content: <ProjectModelPanel currentTab={currentTab} />,
      },
      {
        title: intl.formatMessage({ id: 'private' }),
        key: ModelType.Private,
        content: <PrivateModelPanel currentTab={currentTab} />,
      },
      {
        title: intl.formatMessage({ id: 'public' }),
        key: ModelType.Public,
        content: <PublicModelPanel currentTab={currentTab} />,
      },
    ];
  }, [intl, currentTab]);

  return (
    <>
      <Preview />
      <div
        className={`${style.panelContainer} ${collapsed ? style.moveLeft : ''}`}
      >
        <Collapse
          onToggle={() => setCollapsed(!collapsed)}
          collapsed={collapsed}
        />
        <div className={style.panel}>
          <div className={style.tabBarContainer}>
            {tabs.map((tab) => {
              return (
                <div
                  className={`${style.tabItem} ${
                    currentTab === tab.key && style.tabItemActive
                  }`}
                  key={tab.key}
                  onClick={() => {
                    setCurrentTab(tab.key);
                  }}
                >
                  <div className={style.tabTitle}>{tab.title}</div>
                </div>
              );
            })}
          </div>

          <div className={style.contentContainer}>
            {tabs.map((tab) => {
              return (
                <div
                  key={tab.key}
                  className={calc_class_name(
                    style.content,
                    currentTab === tab.key ? style.show : style.hide,
                  )}
                >
                  {tab.content}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

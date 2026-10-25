import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch } from 'react-redux';
import { useIntl } from 'react-intl';

import { IconProjectSkin, IconGame, IconInfo } from '@box/icons';
import { TooltipTrigger } from '@box/box-design';
import { CreativeMode, REQUEST_TIMEOUT, ModelType, SortOrder } from '@box/apis';

import { MenuModal, Panel } from './menu-modal';
import { setCenterPanel } from 'src/redux/edit/creator';
import { apis } from 'src/apis/local-api';
import { clientConfig } from 'src/config/client';
import { getLibraryMapId } from 'src/utils/local-voxa-library';
import { ProjectSkin } from './project-skin/index';
import { SkinLib } from './project-skin/skin-lib';
import { GamepadSkin } from './gamepad-skin';
import { CenterPanelEnum } from '../../defs';
import { editor } from 'src/client/edit/edit-client';
import {
  PlayerSkin,
  PlayerSkinList,
  setDefaultSkinId,
  setExtensionSkins,
} from 'src/redux/edit/player-skin';
import { reduxDispatch, store } from 'src/redux/edit';
import { ScrollAction, ScrollManage } from '../scroll-trigger';

import style from './style.module.scss';

/** 每次请求皮肤数据数量（每一页的皮肤数量）*/
export const FETCH_LIMIT = 12;

export async function fetchSkinData(query: {
  modelType?: ModelType;
  modelName?: string;
  offset?: number;
  limit?: number;
  orderBy?: SortOrder;
}): Promise<PlayerSkinList | undefined> {
  const {
    modelType,
    modelName,
    offset,
    limit = FETCH_LIMIT,
    orderBy = SortOrder.ModifyTimeDesc,
  } = query;
  try {
    const res = await apis.models.getModelsUsingGetV2(
      {
        modelType,
        modelName,
        offset,
        limit,
        mapId: getLibraryMapId(
          clientConfig.isLocalGameServer,
          clientConfig.mapInfo.contentId,
        ),
        // 1, 自由创作；2，定向创作皮肤
        creativeMode: CreativeMode.Skin,
        containerMode: clientConfig.mode,
        orderBy,
        excludeDefaultSkin: true,
      },
      {
        timeout: REQUEST_TIMEOUT,
      },
    );
    const skinListRes = res.rows;
    let skins: PlayerSkin[] = [];
    for (let i = 0; i < skinListRes.length; i++) {
      const skin = skinListRes[i];
      const item: PlayerSkin = {
        id: skin.modelId,
        name: skin.modelName,
        previewUrl: skin.modelPreviewUrl || '',
      };
      skins.push(item);
    }
    return skins;
  } catch (e) {
    editor.logger.error(`error fetching ${modelType} skin: ${e}`);
  }
  return;
}

export const refreshSkinsList = async () => {
  const editStore = store.getState();
  const { sortBy, searchName } = editStore.playerSkin;
  const defaultSkin = await apis.model.getDefaultSkinUsingGet(
    {
      mapId: clientConfig.mapInfo.contentId,
      mode: clientConfig.mode,
    },
    {
      timeout: REQUEST_TIMEOUT,
    },
  );
  let needDefaultSkin: boolean = false;
  const skins: PlayerSkin[] = [];

  // 默认皮肤放在最前面
  if (defaultSkin) {
    reduxDispatch(setDefaultSkinId(defaultSkin.modelId));
    if (!searchName || defaultSkin.modelName.includes(searchName)) {
      needDefaultSkin = true;
      skins.push({
        id: defaultSkin.modelId,
        name: defaultSkin.modelName,
        previewUrl: defaultSkin.modelPreviewUrl || '',
      });
    }
  }

  const list = await fetchSkinData({
    modelType: ModelType.ExtensionLib,
    limit: needDefaultSkin ? FETCH_LIMIT - 1 : FETCH_LIMIT,
    orderBy: sortBy,
    modelName: searchName,
  });

  if (list) {
    skins.push(...list);
  }

  reduxDispatch(setExtensionSkins(skins));
};

export enum PlayerTabs {
  /** 项目皮肤库 */
  ProjectSkin,
  /** 虚拟手柄按键 */
  GamepadSkin,
}
/**
 * 玩家模块弹窗
 */
export const PlayerManager = () => {
  const intl = useIntl();
  const dispatch = useDispatch();

  const [showSecondary, setShowSecondary] = useState(false);
  const projectSkinScrollRef = useRef<ScrollManage>(null);

  /**
   * 刷新项目皮肤列表 & 列表滚动条高度重置为0
   * */
  const refreshProjectSkins = useCallback(async () => {
    await refreshSkinsList();
    if (projectSkinScrollRef.current) {
      projectSkinScrollRef.current[ScrollAction.setScrollHeight](0);
    }
  }, []);

  // 初次加载
  useEffect(() => {
    refreshProjectSkins();
  }, [refreshProjectSkins]);

  /**
   * 玩家模块-菜单项
   */
  const playerPanels: Panel[] = useMemo(
    (): Panel[] => [
      {
        id: PlayerTabs.ProjectSkin,
        title: intl.formatMessage({ id: 'gamePlayerProjectSkinLib' }),
        icon: <IconProjectSkin />,
        content: (
          <ProjectSkin
            showSkinLib={() => setShowSecondary(true)}
            ref={projectSkinScrollRef}
            refreshProjectSkins={refreshProjectSkins}
          />
        ),
        secondaryContent: (
          <SkinLib
            onClose={() => setShowSecondary(false)}
            onImportSuccess={() => {
              refreshProjectSkins();
            }}
          />
        ),
      },
      {
        id: PlayerTabs.GamepadSkin,
        icon: <IconGame />,
        title: intl.formatMessage({ id: 'playerGamepad' }),
        titleSuffix: (
          <TooltipTrigger
            text={intl.formatMessage({ id: 'playerGamepadTooltips' })}
            placement="rightTop"
            align={{ offset: [8, 0] }}
          >
            <div className={style.titleSuffixIcon}>
              <IconInfo />
            </div>
          </TooltipTrigger>
        ),
        content: <GamepadSkin />,
      },
    ],
    [intl, refreshProjectSkins],
  );

  return (
    <MenuModal
      modalTitle={intl.formatMessage({ id: 'gamePlayer' })}
      panelList={playerPanels}
      onClose={() => dispatch(setCenterPanel(CenterPanelEnum.None))}
      showSecondary={showSecondary}
      onToggleSecondary={setShowSecondary}
    />
  );
};

import {
  ReactNode,
  Ref,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useIntl } from 'react-intl';
import { useSelector } from 'react-redux';
import { IconAdd2 } from '@box/icons';
import { ItemId, Menu, MenuItemOptions, Trigger } from '@box/box-design';
import { useEdit } from 'src/client/edit/edit-context';
import { RootState } from 'src/redux/edit';
import { GameUIPropsContext, PropTabType } from '../defs';
import { PropertyTab } from './tab';
import styles from './style.module.scss';

export type TabsConfig = Partial<Record<PropTabType, boolean | undefined>>;

type Props = {
  config: TabsConfig;
};

const CONFIG_LIST = [
  {
    tabType: PropTabType.Basic,
    contentId: 'gameUIPropBasic',
  },
  {
    tabType: PropTabType.Screen,
    contentId: 'gameUIPropBasic',
  },
  {
    tabType: PropTabType.Text,
    contentId: 'gameUIPropText',
  },
  {
    tabType: PropTabType.Input,
    contentId: 'gameUIPropInput',
  },
  {
    tabType: PropTabType.Image,
    contentId: 'gameUIPropImage',
  },
  {
    tabType: PropTabType.ScrollBox,
    contentId: 'gameUIPropScrollBox',
  },
  {
    tabType: PropTabType.AutoLayout,
    contentId: 'gameUIPropAutoLayout',
  },
];

const OPTIONAL_LIST = [
  {
    id: PropTabType.AutoLayout,
    contentId: 'gameUIPropAutoLayout',
  },
];

function PropertyTabsView(props: Props, ref: Ref<HTMLDivElement | null>) {
  const { config } = props;

  const intl = useIntl();

  const { selectedTab, scrollCardByTab: setSelectedTab } =
    useContext(GameUIPropsContext);

  const items = useMemo(
    () =>
      CONFIG_LIST.reduce<ReactNode[]>((list, current) => {
        if (config[current.tabType]) {
          list.push(
            <PropertyTab
              tabType={current.tabType}
              key={current.tabType}
              selected={current.tabType === selectedTab}
              content={intl.formatMessage({
                id: current.contentId,
              })}
              onSelect={setSelectedTab}
            />,
          );
        }

        return list;
      }, []),
    [intl, config, selectedTab, setSelectedTab],
  );

  const innerRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => innerRef.current!, []);

  const { gameUIEditor } = useEdit();

  const { selectedIds, selectedScreenId } = useSelector((state: RootState) => ({
    selectedIds: state.gameUI.selectedIds,
    selectedScreenId: state.gameUI.screen.selectedScreenId,
  }));

  const onOptionalPropSelect = useCallback(
    (id: ItemId) => {
      switch (id) {
        case PropTabType.AutoLayout:
          // 空选时，编辑屏幕
          if (!selectedIds.length && selectedScreenId) {
            gameUIEditor.uiTreeController.toggleNodesLayout(
              [selectedScreenId],
              true,
            );
          } else {
            gameUIEditor.uiTreeController.toggleNodesLayout(selectedIds, true);
          }
          break;
      }
    },
    [gameUIEditor.uiTreeController, selectedIds, selectedScreenId],
  );

  const menu = useMemo(() => {
    const items = OPTIONAL_LIST.map<MenuItemOptions>(({ id, contentId }) => {
      return {
        id,
        text: intl.formatMessage({
          id: contentId,
        }),
        disabled: config[id],
      };
    });

    return (
      <Menu selectedItem="" items={items} onItemSelect={onOptionalPropSelect} />
    );
  }, [intl, onOptionalPropSelect, config]);

  return (
    <div ref={innerRef} className={styles.tabs}>
      <div className={styles.itemsScroll}>
        <div className={styles.items}>{items}</div>
      </div>
      <div className={styles.divider} />
      <Trigger
        action={['click']}
        popup={menu}
        delay={0}
        placement="rightTop"
        align={{ offset: [4, 0] }}
      >
        <PropertyTab content={<IconAdd2 />} />
      </Trigger>
    </div>
  );
}

export const PropertyTabs = memo(forwardRef(PropertyTabsView));

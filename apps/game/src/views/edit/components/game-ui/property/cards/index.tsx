import {
  Ref,
  UIEventHandler,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useIntl } from 'react-intl';
import { MenuItemOptions, Modal, Toast } from '@box/box-design';

import { useEdit } from 'src/client/edit/edit-context';
import { ArenaEditorUIContext } from 'src/views/edit/editor-ui-context';
import { OnCardMenuItemSelect, PropertyCard } from './card';
import { BasicProperty } from '../basic-property';
import { TextProperty } from '../text-property';
import { PictureLibrary } from '../../../picture-library';
import { ImageProperty } from '../image-property';
import {
  CARD_ID_PREFIX,
  GameUIPropsContext,
  OptionalPropMenuIds,
  PropTabType,
} from '../defs';
import { isCardActive } from '../util';
import { useResizeObserver } from 'src/views/hooks';
import { AutoLayoutProperty } from '../auto-layout';
import { ScrollBoxProperty } from '../scroll-box-property';
import styles from './style.module.scss';
import { InputProperty } from 'src/views/edit/components/game-ui/property/input-property';
import { useUploadPicture } from 'src/views/edit/components/picture-library/hooks';
import { ScreenProperty } from 'src/views/edit/components/game-ui/property/screen-property';
import { RootState } from 'src/redux/edit';

type Props = {
  textIds: string[];
  inputIds: string[];
  imageIds: string[];
  scrollBoxIds: string[];
  autoLayoutIds: string[];
  screenIds: string[];
};
function PropertyCardsView(props: Props, ref: Ref<HTMLDivElement | null>) {
  const {
    textIds,
    inputIds,
    imageIds,
    scrollBoxIds,
    autoLayoutIds,
    screenIds,
  } = props;

  const { selectedIds } = useSelector((state: RootState) => ({
    selectedIds: state.gameUI.selectedIds,
  }));

  const intl = useIntl();

  const textProperty = useMemo(() => {
    if (textIds.length === 0) {
      return;
    }

    return (
      <PropertyCard
        key={PropTabType.Text}
        tabType={PropTabType.Text}
        header={intl.formatMessage({ id: 'gameUIPropText' })}
        content={<TextProperty ids={textIds} />}
      />
    );
  }, [textIds, intl]);

  const screenProperty = useMemo(() => {
    if (screenIds.length === 0) {
      return;
    }

    return (
      <PropertyCard
        key={PropTabType.Screen}
        tabType={PropTabType.Screen}
        header={intl.formatMessage({ id: 'gameUIPropBasic' })}
        content={<ScreenProperty ids={screenIds} />}
      />
    );
  }, [screenIds, intl]);

  const inputProperty = useMemo(() => {
    if (inputIds.length === 0) {
      return;
    }

    return (
      <PropertyCard
        key={PropTabType.Input}
        tabType={PropTabType.Input}
        header={intl.formatMessage({ id: 'gameUIPropInput' })}
        content={<InputProperty ids={inputIds} />}
      />
    );
  }, [inputIds, intl]);

  const imageProperty = useMemo(() => {
    if (imageIds.length === 0) {
      return;
    }

    return (
      <PropertyCard
        key={PropTabType.Image}
        tabType={PropTabType.Image}
        header={intl.formatMessage({ id: 'gameUIPropImage' })}
        content={<ImageCardContent ids={imageIds} />}
      />
    );
  }, [imageIds, intl]);

  const scrollBoxProperty = useMemo(() => {
    if (scrollBoxIds.length === 0) {
      return;
    }

    return (
      <PropertyCard
        key={PropTabType.ScrollBox}
        tabType={PropTabType.ScrollBox}
        header={intl.formatMessage({ id: 'gameUIPropScrollBox' })}
        content={<ScrollBoxProperty ids={scrollBoxIds} />}
      />
    );
  }, [scrollBoxIds, intl]);

  const CARD_MENU_ITEMS = useMemo<Record<OptionalPropMenuIds, MenuItemOptions>>(
    () => ({
      [OptionalPropMenuIds.Remove]: {
        id: OptionalPropMenuIds.Remove,
        text: intl.formatMessage({ id: 'remove' }),
      },
    }),
    [intl],
  );

  const { gameUIEditor } = useEdit();

  const removeOptionalProp = useCallback(
    (tabType: PropTabType) => {
      const destroy = Modal.show({
        title: intl.formatMessage({
          id: 'gameUIPropDeleteTitle',
        }),
        content: intl.formatMessage({
          id: 'gameUIPropDeleteContent',
        }),
        confirmText: intl.formatMessage({
          id: 'delete',
        }),
        onConfirm: () => {
          if (tabType === PropTabType.AutoLayout) {
            gameUIEditor.uiTreeController.toggleNodesLayout(
              autoLayoutIds,
              false,
            );
          }
          destroy();
        },
        cancelText: intl.formatMessage({
          id: 'cancel',
        }),
        onCancel: () => {
          destroy();
        },
        type: 'warning',
        buttonSort: 'rtl',
      });
    },
    [autoLayoutIds, gameUIEditor, intl],
  );

  const onOptionalPropMenuItem = useCallback<OnCardMenuItemSelect>(
    (menuId, tabType) => {
      switch (menuId) {
        case OptionalPropMenuIds.Remove:
          removeOptionalProp(tabType);
          break;
      }
    },
    [removeOptionalProp],
  );

  const autoLayoutProperty = useMemo(() => {
    if (autoLayoutIds.length === 0) {
      return;
    }

    return (
      <PropertyCard
        key={PropTabType.AutoLayout}
        tabType={PropTabType.AutoLayout}
        header={intl.formatMessage({ id: 'gameUIPropAutoLayout' })}
        content={<AutoLayoutProperty ids={autoLayoutIds} />}
        menuOptions={{
          items: [CARD_MENU_ITEMS[OptionalPropMenuIds.Remove]],
          onItemSelect: onOptionalPropMenuItem,
        }}
      />
    );
  }, [autoLayoutIds, intl, onOptionalPropMenuItem, CARD_MENU_ITEMS]);

  const items = useMemo(() => {
    const result = [
      <PropertyCard
        key={PropTabType.Basic}
        tabType={PropTabType.Basic}
        header={intl.formatMessage({
          id: 'gameUIPropBasic',
          defaultMessage: 'basic',
        })}
        content={<BasicProperty />}
      />,
      screenProperty,
      textProperty,
      inputProperty,
      imageProperty,
      scrollBoxProperty,
      autoLayoutProperty,
    ];

    // 空选节点时，不需要basic
    if (!selectedIds.length) {
      result.shift();
    }
    return result;
  }, [
    intl,
    screenProperty,
    textProperty,
    inputProperty,
    imageProperty,
    scrollBoxProperty,
    autoLayoutProperty,
    selectedIds.length,
  ]);

  /**
   * 表示在当wheel事件中，容器的scrollTop数值。
   */
  const cardsScrollTop = useRef(0);

  const { selectedTab, selectTabByCard } = useContext(GameUIPropsContext);

  // 用ref引用当前选中的卡片id，避免触发onScroll的频繁更新
  const currentCardId = useRef('');
  currentCardId.current = `#${CARD_ID_PREFIX}${selectedTab}`;

  // 记录滚动区域当前内部的卡片id，在onScroll时对比currentCardId，来决定是否执行滚动选中
  const scrollCardId = useRef(currentCardId.current);

  const innerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => innerRef.current!, []);

  const itemsRef = useRef<HTMLDivElement>(null);

  const updateActiveCardByPos = useCallback(() => {
    if (!innerRef.current || !itemsRef.current) {
      return;
    }

    cardsScrollTop.current = innerRef.current.scrollTop;

    for (const card of itemsRef.current.children) {
      if (!(card instanceof HTMLDivElement)) {
        continue;
      }

      const tabType = isCardActive(card, cardsScrollTop.current);

      if (tabType !== undefined) {
        selectTabByCard(tabType);
        scrollCardId.current = card.id;
        return;
      }
    }
  }, [selectTabByCard]);

  useResizeObserver(itemsRef.current, updateActiveCardByPos);

  const onScroll = useCallback<UIEventHandler<HTMLDivElement>>(
    (e) => {
      /**
       * 1. 如果是滚动卡片导致切选中，会先滚动，再更新选中id。
       * 2. 如果是点击tab导致切换选中，会先更新选中id，再触发滚动。
       *
       * 通过滚动时，id是已变化，来判断是哪一种。如果是2，那就不执行后续的逻辑。
       */
      if (scrollCardId.current !== currentCardId.current) {
        scrollCardId.current = currentCardId.current;
        return;
      }

      if (cardsScrollTop.current === e.currentTarget.scrollTop) {
        return;
      }

      updateActiveCardByPos();
    },
    [updateActiveCardByPos],
  );

  return (
    <div ref={innerRef} className={styles.cards} onScroll={onScroll}>
      <div ref={itemsRef} className={styles.items}>
        {items}
      </div>
    </div>
  );
}

export const PropertyCards = memo(forwardRef(PropertyCardsView));

const ImageCardContent = memo((props: { ids: string[] }) => {
  const [pictureLibraryVisible, setPictureLibraryVisible] = useState(false);
  const [pictureLibraryNodeIds, setPictureLibraryNodeIds] = useState<string[]>(
    [],
  );
  const { assetController, editContentStorage, gameUIEditor } = useEdit();
  const { replica } = useContext(ArenaEditorUIContext);

  const showPictureLibrary = useCallback(
    (ids: string[]) => {
      setPictureLibraryNodeIds(ids);
      setPictureLibraryVisible(true);
    },
    // 保留replica的依赖，协作数据更新时能正确触发
    [replica],
  );

  const intl = useIntl();
  const dispatch = useDispatch();

  const onUploadPictureClick = useUploadPicture({
    intl,
    editContentStorage,
    assetController,
    dispatch,
  });

  const onConfirm = useCallback(
    (selectedKey) => {
      pictureLibraryNodeIds.forEach((nodeId) => {
        gameUIEditor.projectTransaction.push((action) =>
          action.uiTree
            .update(nodeId)
            .update()
            .element.update()
            .image.image(selectedKey),
        );
      });
      gameUIEditor.projectTransaction.commit();
    },
    [gameUIEditor.projectTransaction, pictureLibraryNodeIds],
  );

  const pictureLibrary = useMemo(() => {
    if (!pictureLibraryVisible) {
      return;
    }

    return (
      <PictureLibrary
        onUploadClick={onUploadPictureClick}
        onClose={() => setPictureLibraryVisible(false)}
        onConfirm={onConfirm}
      />
    );
  }, [pictureLibraryVisible, onUploadPictureClick, onConfirm]);

  return (
    <>
      <ImageProperty
        ids={props.ids}
        onUploadClick={onUploadPictureClick}
        showPictureLibrary={showPictureLibrary}
      />
      {pictureLibrary}
    </>
  );
});

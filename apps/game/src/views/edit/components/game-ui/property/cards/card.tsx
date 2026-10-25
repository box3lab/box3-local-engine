import { ReactNode, memo, useCallback, useMemo } from 'react';
import {
  Trigger,
  type MenuOptions,
  Menu,
  Button,
  MenuItemOptions,
} from '@box/box-design';
import { IconMore } from '@box/icons';
import { CARD_ID_PREFIX, PropTabType } from '../defs';
import styles from './card.module.scss';

type Props = {
  tabType: PropTabType;
  header: ReactNode;
  content: ReactNode;
  menuOptions?: {
    items: MenuItemOptions[];
    onItemSelect: OnCardMenuItemSelect;
  };
};

export type OnCardMenuItemSelect = (
  menuId: string,
  tabType: PropTabType,
) => void;

function PropertyCardView(props: Props) {
  const { tabType, header, content, menuOptions } = props;

  const onMenuItemSelect = useCallback<MenuOptions['onItemSelect']>(
    (menuId) => {
      menuOptions?.onItemSelect(String(menuId), tabType);
    },
    [menuOptions, tabType],
  );

  const menuButton = useMemo(() => {
    if (!menuOptions) {
      return;
    }

    return (
      <Trigger
        popup={
          <Menu
            selectedItem=""
            items={menuOptions.items}
            onItemSelect={onMenuItemSelect}
          />
        }
        action={['click']}
        delay={0}
        placement="bottomRight"
        align={{ offset: [0, 4] }}
      >
        <Button
          className={styles.menuButton}
          type="icon"
          icon={<IconMore />}
        ></Button>
      </Trigger>
    );
  }, [menuOptions, onMenuItemSelect]);

  return (
    <div id={`${CARD_ID_PREFIX}${tabType}`} className={styles.card}>
      <div className={styles.header}>
        {header}
        {menuButton}
      </div>
      {content}
    </div>
  );
}

export const PropertyCard = memo(PropertyCardView);

import React from 'react';
import { clientConfig } from 'src/config/client';
import { Icon } from '../../basic/icon';
import { isCreatera } from 'src/utils/appEdition';
import { messenger } from 'src/messenger';
import style from './index.module.css';

export const Logo = React.memo(
  (props: {
    className?: string;
    width?: string;
    white?: boolean; // use logo 2
    size?: number;
  }) => {
    const link = clientConfig.WEBSITE_URL || '/';

    return (
      <span
        className={props.className}
        onClick={() => messenger.jumpTo({ url: link })}
      >
        {('customizeType' in clientConfig && clientConfig.customizeType) ? (
          <></>
        ) : (
          <Icon
            style={{ width: props.width }}
            icon={
              props.white
                ? isCreatera()
                  ? 'createra-logo'
                  : 'box3-logo'
                : 'logo'
            }
            size={props.size || 120}
            className={style.logo}
          />
        )}
      </span>
    );
  },
);

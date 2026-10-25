import React, { CSSProperties } from 'react';
import { calc_class_name } from 'src/utils/classname';
import style from './index.module.css';

interface BorderProps {
  size: number;
}
interface Props {
  children?: React.ReactNode;
  hideDot?: boolean;
  color?: string;
  mode?: 'inside' | 'vertical' | 'leftside' | 'topRight';
  size?: number; // default: 8px.
  bordered?: boolean | BorderProps;
  onClick?: () => void;
}

export const Dot: React.FC<Props> = React.memo((props) => {
  const { mode, size = 8, hideDot, bordered, onClick, children, color } = props;

  const borderColor = 'white';
  const css: CSSProperties = {
    width: size,
    height: size,
    color: color ? color : 'red',
  };

  if (bordered) {
    if (typeof bordered === 'boolean') {
      css.border = `2px solid ${borderColor}`;
    } else {
      css.border = `${bordered.size}px solid ${borderColor}`;
    }
  }

  return (
    <div
      className={`
                ${style.dotContainer}
                ${mode === 'inside' ? style.inside : ''}
                ${mode === 'vertical' ? style.vertical : ''}
            `}
      onClick={onClick}
    >
      {children}
      {!hideDot && (
        <div
          style={css}
          className={calc_class_name(
            style.dot,
            mode === 'leftside' && style.leftside,
            mode === 'topRight' && style.topRight,
          )}
        />
      )}
    </div>
  );
});

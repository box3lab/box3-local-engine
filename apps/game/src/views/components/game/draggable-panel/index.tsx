import * as React from 'react';
import { touchable } from 'src/utils/mobile';

import style from './index.module.css';

type Props = {
  children?: React.ReactNode;
  title: React.ReactElement<any>;
  initialPosition: {
    top: number;
    left: number;
  };
  limit?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
};

type State = {
  x: number;
  y: number;
};

export class DraggablePanel extends React.Component<Props, State> {
  private mouseX = 0;
  private mouseY = 0;
  private containerElm: HTMLElement | undefined;
  constructor(props: Props) {
    super(props);
    this.state = {
      x: this.props.initialPosition.left,
      y: this.props.initialPosition.top,
    };
  }

  public componentWillUnmount() {
    if (touchable) {
      window.removeEventListener('touchmove', this.onMouseMove);
      window.removeEventListener('touchend', this.onMouseUp);
    } else {
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('mouseup', this.onMouseUp);
    }
  }

  private onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    this.mouseX =
      (e as React.MouseEvent).clientX ||
      (e as React.TouchEvent).touches[0].clientX;
    this.mouseY =
      (e as React.MouseEvent).clientY ||
      (e as React.TouchEvent).touches[0].clientY;
    if (touchable) {
      window.addEventListener('touchmove', this.onMouseMove);
      window.addEventListener('touchend', this.onMouseUp);
    } else {
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseUp);
    }
  };

  private onMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!this.containerElm) {
      return;
    }
    const mouseX =
      (e as MouseEvent).clientX || (e as TouchEvent).touches[0].clientX;
    const mouseY =
      (e as MouseEvent).clientY || (e as TouchEvent).touches[0].clientY;
    let targetX = this.state.x + mouseX - this.mouseX;
    let targetY = this.state.y + mouseY - this.mouseY;
    if (this.props.limit) {
      if (this.props.limit.top) {
        if (targetY < this.props.limit.top) {
          targetY = this.props.limit.top;
        }
      }
      if (this.props.limit.bottom) {
        const height = this.containerElm.clientHeight;
        if (targetY + height > this.props.limit.bottom) {
          targetY = this.props.limit.bottom - height;
        }
      }
      if (this.props.limit.left) {
        if (targetX < this.props.limit.left) {
          targetX = this.props.limit.left;
        }
      }
      if (this.props.limit.right) {
        const width = this.containerElm.clientWidth;
        if (targetX + width > this.props.limit.right) {
          targetX = this.props.limit.right - width;
        }
      }
    }

    this.setState({
      x: targetX,
      y: targetY,
    });
    this.mouseX = mouseX;
    this.mouseY = mouseY;
  };

  private onMouseUp = () => {
    if (touchable) {
      window.removeEventListener('touchmove', this.onMouseMove);
      window.removeEventListener('touchend', this.onMouseUp);
    } else {
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('mouseup', this.onMouseUp);
    }
  };

  public render() {
    return (
      <div
        className={style.container}
        style={{ top: this.state.y, left: this.state.x }}
        ref={(ref) => {
          if (ref) {
            this.containerElm = ref;
          }
        }}
      >
        <div
          className={style.title}
          onMouseDown={(e) => !touchable && this.onMouseDown(e)}
          onTouchStart={(e) => touchable && this.onMouseDown(e)}
        >
          {this.props.title}
        </div>
        <div>{this.props.children}</div>
      </div>
    );
  }
}

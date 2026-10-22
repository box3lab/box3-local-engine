import React from 'react';
import style from './index.module.css';

export interface PopupProps {
  posX?: 'left' | 'right' | 'center' | 'unset'; // default: left
  posY?: 'up' | 'down'; // default: down
  distance?: number;
  arrow?: boolean;
}

interface Props extends PopupProps {
  children?: React.ReactNode;
  popup: React.ReactNode;
  disableClick?: boolean;
  rightClick?: boolean;
  className?: string;
  clickCallback?: () => void;
  popupCallback?: (showPopup: boolean, ev?: React.MouseEvent) => void;
  shouldShowPopup?: () => boolean;
}
interface State {
  showPopup: boolean;
}

export function calcPopupElPosition(spec: {
  popupEl: HTMLDivElement;
  contentEl: HTMLDivElement;
  arrowEl?: HTMLDivElement;
  posX?: 'left' | 'right' | 'center' | 'unset'; // default: left
  posY?: 'up' | 'down'; // default: down
  distance?: number;
}) {
  const { popupEl, contentEl, posX, posY, arrowEl } = spec;
  const { bottom, right, top, left, width } = contentEl.getBoundingClientRect();
  const popupWidth = popupEl.clientWidth;
  const height = popupEl.clientHeight;
  const contentW = contentEl.clientWidth;
  const distance = spec.distance || 0;
  switch (posX) {
    case 'unset':
      break;
    case 'center':
      const l1 = left - (popupWidth - contentW) * 0.5;
      const l2 = Math.max(0, Math.min(l1, window.innerWidth - popupWidth));
      popupEl.style.left = l2 + 'px';
      if (arrowEl) {
        arrowEl.style.transform = `translate(${l1 - l2}px, 0px)`;
      }
      break;
    case 'right':
      popupEl.style.left =
        (window.innerWidth - left - popupWidth < 0
          ? window.innerWidth - popupWidth
          : left) + 'px';
      break;
    case 'left':
    default:
      popupEl.style.left =
        (window.innerWidth - right < 0
          ? window.innerWidth - popupWidth
          : left - popupWidth + width) + 'px';
  }

  switch (posY) {
    case 'up':
      popupEl.style.top = top - height - distance + 'px';
      break;
    case 'down':
    default:
      popupEl.style.top =
        (bottom + height > window.innerHeight
          ? window.innerHeight - height
          : bottom + distance) + 'px';
  }
}

export class ClickPopup extends React.Component<Props, State> {
  public contentEl: HTMLDivElement | null = null;
  public popupEl: HTMLDivElement | null = null;
  public arrowEl: HTMLDivElement | null = null;
  public closeWrapperEl: HTMLDivElement | null = null;

  public state = {
    showPopup: false,
  };

  public scrollListener = () => {
    this.setState({ showPopup: false });
  };
  public closeWrapperTouchStartListener = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    this.showPopup(false, ev);
  };
  public closeWrapperWheelListener = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    this.showPopup(false, ev);
  };

  public componentDidMount() {
    window.addEventListener('scroll', this.scrollListener);
    if (this.closeWrapperEl) {
      // fix: Unable to preventDefault inside passive event listener due to target being treated as passive.
      this.closeWrapperEl.addEventListener(
        'onwheel',
        this.closeWrapperWheelListener,
        { passive: false },
      );
      this.closeWrapperEl.addEventListener(
        'ontouchstart',
        this.closeWrapperTouchStartListener,
        { passive: false },
      );
    }
  }
  public componentWillUnmount() {
    window.removeEventListener('scroll', this.scrollListener);
    if (this.closeWrapperEl) {
      this.closeWrapperEl.removeEventListener(
        'onwheel',
        this.closeWrapperWheelListener,
      );
      this.closeWrapperEl.removeEventListener(
        'ontouchstart',
        this.closeWrapperTouchStartListener,
      );
    }
  }

  public showPopup = (show: boolean, ev?: React.MouseEvent) => {
    if (this.props.disableClick) {
      return;
    }
    this.setState({ showPopup: show });
    this.props.popupCallback && this.props.popupCallback(show, ev);
  };

  public componentDidUpdate() {
    if (
      !this.popupEl ||
      !this.state.showPopup ||
      !this.contentEl ||
      !this.arrowEl
    ) {
      return;
    }
    calcPopupElPosition({
      distance: this.props.distance,
      popupEl: this.popupEl,
      arrowEl: this.arrowEl,
      contentEl: this.contentEl,
      posX: this.props.posX,
      posY: this.props.posY,
    });
  }

  public render() {
    return (
      <div className={style.container + ' ' + (this.props.className || '')}>
        {this.state.showPopup && (
          <div
            className={style.closeWrapper}
            ref={(el) => {
              this.closeWrapperEl = el;
            }}
            onClick={(ev) => {
              ev.stopPropagation();
              this.showPopup(false, ev);
            }}
            onMouseDown={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              this.showPopup(false, ev);
            }}
          ></div>
        )}
        <div
          className={style.content + ' popupContent'}
          ref={(el) => {
            this.contentEl = el;
          }}
          onContextMenu={(e) => {
            e.stopPropagation();
            if (this.props.rightClick) {
              if (this.props.shouldShowPopup && !this.props.shouldShowPopup()) {
                return;
              }
              this.showPopup(true, e);
              this.props.clickCallback && this.props.clickCallback();
              e.preventDefault();
            }
          }}
          onClick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            if (!this.props.rightClick) {
              if (this.props.shouldShowPopup && !this.props.shouldShowPopup()) {
                return;
              }
              this.showPopup(true, ev);
              this.props.clickCallback && this.props.clickCallback();
            }
          }}
        >
          {this.props.children}
        </div>
        {this.state.showPopup && (
          <div
            className={style.popup}
            ref={(el) => {
              this.popupEl = el;
            }}
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              this.showPopup(false);
            }}
          >
            {this.props.popup}
            <div
              className={style.arrow}
              ref={(el) => {
                this.arrowEl = el;
              }}
              style={{
                display: this.props.arrow ? 'block' : 'none',
              }}
            ></div>
          </div>
        )}
      </div>
    );
  }
}

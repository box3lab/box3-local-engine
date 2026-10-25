import * as React from 'react';
import { touchable } from 'src/utils/mobile';

import style from './index.module.css';

type Props = {
  children?: React.ReactNode;
  title: string;
  onClose: () => void;
  fullHeight?: boolean;
  className?: string;
  hideTitle?: boolean;
  contentClassName?: string;
  bgMask?: boolean;
};

type State = {};

export class PanelContainer extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  public render() {
    return (
      <div
        className={this.props.className || style.panelContainer}
        style={{
          height: this.props.fullHeight ? window.innerHeight + 'px' : undefined,
        }}
      >
        {this.props.bgMask && (
          <div className={style.bgMask} onClick={this.props.onClose}></div>
        )}
        {!this.props.hideTitle && (
          <div className={style.panelTitleWrapper}>
            <div className={style.panelTitle}>{this.props.title}</div>
            {!this.props.bgMask && (
              <div
                className={style.closeBtnContainer}
                onClick={!touchable ? this.props.onClose : undefined}
                onTouchStart={touchable ? this.props.onClose : undefined}
              >
                <div className={style.closeBtn}></div>
              </div>
            )}
          </div>
        )}
        <div
          className={this.props.contentClassName || style.panelContent}
          style={{
            flex: this.props.fullHeight ? 1 : undefined,
          }}
        >
          {this.props.children}
        </div>
      </div>
    );
  }
}

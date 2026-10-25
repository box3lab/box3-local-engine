import * as React from 'react';
import { Button } from '../button';
import { calc_class_name } from 'src/utils/classname';

import style from './index.module.css';

type ModalProps = {
  children?: React.ReactNode;
  title?: string;
  smallTitle?: boolean;
  visible: boolean;
  confirm?: string;
  cancel?: string;
  width?: number;
  center?: boolean;
  footer?: React.ReactNode;
  contentNoOverlay?: boolean;
  handleConfirm?: () => void;
  handleCancel?: () => void;
  disableConfirm?: boolean;
  style?: React.CSSProperties;
  divider?: boolean;
  operationDivider?: boolean;
  disableBackgroundClick?: boolean;
  mobileFullScreen?: boolean;
  dangerToConfirm?: boolean;
  contentClass?: string;
};

type ModalState = {};

export class Modal extends React.Component<ModalProps, ModalState> {
  private _backgroundClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!this.props.disableBackgroundClick) {
      this.props.handleCancel && this.props.handleCancel();
    }
  };
  private _handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    this.props.handleConfirm && this.props.handleConfirm();
  };
  private _handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    this.props.handleCancel && this.props.handleCancel();
  };
  public render() {
    let customizeStyle = this.props.style || {};
    if (this.props.width !== undefined) {
      customizeStyle = Object.assign(
        { width: this.props.width },
        customizeStyle,
      );
    }
    return (
      <div
        className={
          (this.props.visible ? style.modal : style.modalHidden) +
          ' ' +
          (this.props.mobileFullScreen ? style.fullScreen : ' ')
        }
        onClick={this._backgroundClick}
      >
        <div
          className={style.modalContainer}
          style={customizeStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={[
              style.title,
              this.props.smallTitle ? style.smallTitle : '',
            ].join(' ')}
          >
            <div className={style.titleDecorator}></div>
            {this.props.title}
          </div>
          <div
            className={[
              style.content,
              this.props.contentNoOverlay ? '' : style.overlay,
              this.props.contentClass ? this.props.contentClass : '',
            ].join(' ')}
          >
            {this.props.children}
            {this.props.divider && (
              <div className={style.divider}>
                <hr />
              </div>
            )}
          </div>
          {this.props.footer !== undefined ? (
            this.props.footer
          ) : (
            <div
              className={calc_class_name(
                this.props.center ? style.centerOperations : style.operations,
                this.props.operationDivider ? style.operationDivider : '',
              )}
            >
              {this.props.cancel !== undefined ? (
                <div className={style.cancelBtn}>
                  <Button
                    value={this.props.cancel}
                    onClick={this._handleCancel}
                  />
                </div>
              ) : null}
              {this.props.confirm && (
                <div className={style.confirmBtn}>
                  <Button
                    type={this.props.dangerToConfirm ? 'danger' : 'primary'}
                    value={this.props.confirm}
                    onClick={this._handleConfirm}
                    disabled={this.props.disableConfirm}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}

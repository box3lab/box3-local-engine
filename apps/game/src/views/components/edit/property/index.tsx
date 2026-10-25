import * as React from 'react';
import { IntlShape, injectIntl } from 'react-intl';
import { Input } from '../input';
import { RadioInput } from '../radio';
import { Range } from '../inputSlider';
import { Switch } from '../switch';
import { quat } from 'gl-matrix';
import { calc_class_name } from 'src/utils/classname';
import { quatToAxisAngleForm } from 'src/utils/rotate';
import { throttle } from 'src/utils/debounce-throttle';

import style from './index.module.css';

type Props = {
  children?: React.ReactNode;
  name: string;
  value: string | number | boolean;
  customInput?: boolean;
  slider?: [number, number];
  switch?: {
    id: number;
    text: string;
  }[];
  disabled?: boolean;
  disabledStyle?: string;
  icon?: string;
  iconStyle?: string;
  nameStyle?: React.CSSProperties;
  inputStyle?: { [key: string]: string };
  inputContainerStyle?: React.CSSProperties;
  numberFixed?: number;
  liveUpdate?: boolean;
  isError?: boolean;
  errorMessage?: string;
  formatValue?: (v: any) => any;
  onSliderDragEnd?: (v: number) => void;
  onIconClick?: () => void;
  onChange: (value: string | number | boolean) => void;
  sliderOnChange?: (v: number) => void;
  onToggle?: (available: boolean) => void;
};

type State = {
  // value:string;
};

// this Class will likely to be ditched
export class Property extends React.Component<Props, State> {
  public numberFixed = 1;
  constructor(props: Props) {
    super(props);
    if (props.numberFixed !== undefined) {
      this.numberFixed = props.numberFixed;
    }
    this.state = {};
  }

  public render() {
    return (
      <div
        className={
          !this.props.disabled
            ? style.property
            : this.props.disabledStyle || style.propertyDisabled
        }
      >
        <div className={style.propertyWrapper}>
          <div className={style.propName} style={this.props.nameStyle}>
            {this.props.name}
          </div>
          {this.props.customInput ? (
            <>{this.props.children}</>
          ) : (
            <>
              {this.props.onToggle !== undefined &&
                this.props.disabled !== undefined && (
                  <RadioInput
                    active={!this.props.disabled}
                    onChange={(v) =>
                      this.props.onToggle && this.props.onToggle(v)
                    }
                  />
                )}
              {!this.props.switch && (
                <div className={style.propValue}>
                  {this.props.formatValue && (
                    <Input
                      inputStyle={this.props.inputStyle}
                      containerStyle={this.props.inputContainerStyle}
                      value={this.props.formatValue(this.props.value)}
                      onChange={this.props.onChange}
                      small
                      disabled={this.props.disabled}
                      numberFixed={this.numberFixed}
                      isError={this.props.isError}
                      errorMessage={this.props.errorMessage}
                    />
                  )}
                  {!this.props.formatValue &&
                    typeof this.props.value === 'string' && (
                      <Input
                        inputStyle={this.props.inputStyle}
                        containerStyle={this.props.inputContainerStyle}
                        value={this.props.value}
                        onChange={this.props.onChange}
                        small
                        disabled={this.props.disabled}
                        numberFixed={this.numberFixed}
                        isError={this.props.isError}
                        errorMessage={this.props.errorMessage}
                      />
                    )}
                  {!this.props.formatValue &&
                    typeof this.props.value === 'number' && (
                      <Input
                        inputStyle={this.props.inputStyle}
                        containerStyle={this.props.inputContainerStyle}
                        value={this.props.value}
                        onChange={this.props.onChange}
                        small
                        number
                        disabled={this.props.disabled}
                        numberFixed={this.numberFixed}
                        isError={this.props.isError}
                        errorMessage={this.props.errorMessage}
                      />
                    )}
                  {!this.props.formatValue &&
                    typeof this.props.value === 'boolean' && (
                      <RadioInput
                        active={this.props.value}
                        onChange={this.props.onChange}
                        disabled={this.props.disabled}
                      />
                    )}
                </div>
              )}
            </>
          )}
        </div>

        {this.props.slider && (
          <div
            className={
              this.props.icon ? style.inputSliderWithIcon : style.inputSlider
            }
          >
            {this.props.icon && (
              <div
                className={calc_class_name(
                  style.inputSliderIconWrapper,
                  this.props.iconStyle,
                )}
                onClick={this.props.onIconClick}
              >
                <div className={this.props.icon} />
              </div>
            )}
            <Range
              value={+this.props.value}
              onValueChange={(value: number) => {
                if (this.props.liveUpdate !== false) {
                  this.props.sliderOnChange
                    ? this.props.sliderOnChange(value)
                    : this.props.onChange(value);
                }
              }}
              min={this.props.slider[0]}
              max={this.props.slider[1]}
              disabled={this.props.disabled}
              dragEndCb={(value: number) => {
                this.props.sliderOnChange
                  ? this.props.sliderOnChange(value)
                  : this.props.onChange(value);
                this.props.onSliderDragEnd && this.props.onSliderDragEnd(value);
              }}
            />
          </div>
        )}
        {this.props.switch && (
          <div className={style.switchWrapper}>
            <Switch
              currentOperation={+this.props.value}
              operationList={[...this.props.switch]}
              onChange={(e) => this.props.onChange(e)}
              disabled={this.props.disabled}
            />
          </div>
        )}
      </div>
    );
  }
}

interface StringPropertyProps {
  name: string;
  value: string;
  disabled?: boolean;
  disabledStyle?: string;
  nameStyle?: React.CSSProperties;
  inputStyle?: { [key: string]: string };
  inputContainerStyle?: React.CSSProperties;
  formatValue?: (v: any) => any;
  onChange: (value: string) => void;
}

interface StringPropertyState {}

export class StringProperty extends React.Component<
  StringPropertyProps,
  StringPropertyState
> {
  constructor(props) {
    super(props);
  }

  public render() {
    return (
      <div
        className={
          !this.props.disabled
            ? style.property
            : this.props.disabledStyle || style.propertyDisabled
        }
      >
        <div className={style.propertyWrapper}>
          <div className={style.propName} style={this.props.nameStyle}>
            {this.props.name}
          </div>
          <>
            <div className={style.propValue}>
              <Input
                inputStyle={this.props.inputStyle}
                containerStyle={this.props.inputContainerStyle}
                value={
                  this.props.formatValue
                    ? this.props.formatValue(this.props.value)
                    : this.props.value
                }
                onChange={this.props.onChange}
                small
                disabled={this.props.disabled}
              />
            </div>
          </>
        </div>
      </div>
    );
  }
}

interface NumberPropertyProps {
  name: string;
  value: number;
  rawInputMiddleware?: (rawInput: string) => number;
  slider?: [number, number];
  onChange: (value: number) => void;
  throttlingDelay?: number; // in million Seconds, minimum is 50;
  disabled?: boolean;
  disabledStyle?: string;
  icon?: string;
  iconStyle?: string;
  nameStyle?: React.CSSProperties;
  inputStyle?: { [key: string]: string };
  inputContainerStyle?: React.CSSProperties;
  numberFixed?: number;
  formatValue?: (v: any) => any;
  onIconClick?: () => void;
}

interface NumberPropertyState {
  localValue: number;
  onSliderDraing: boolean;
  updateCounter: number;
}

export class NumberProperty extends React.Component<
  NumberPropertyProps,
  NumberPropertyState
> {
  public numberFixed = 1;
  private throttledOnChange?: (value: number) => void;

  constructor(props) {
    super(props);
    if (props.numberFixed !== undefined) {
      this.numberFixed = props.numberFixed;
    }
    let delay = this.props.throttlingDelay;
    if (delay !== undefined) {
      delay = Math.max(delay, 50);
      this.throttledOnChange = throttle(this.props.onChange, delay);
    }
    this.state = {
      localValue: Number(this.props.value.toFixed(this.numberFixed)),
      updateCounter: 0,
      onSliderDraing: false,
    };
  }

  public render() {
    const processedValue = Number(this.props.value.toFixed(this.numberFixed));
    return (
      <div
        className={
          !this.props.disabled
            ? style.property
            : this.props.disabledStyle || style.propertyDisabled
        }
      >
        <div className={style.propertyWrapper}>
          <div className={style.propName} style={this.props.nameStyle}>
            {this.props.name}
          </div>
          <>
            <div className={style.propValue}>
              <Input
                inputStyle={this.props.inputStyle}
                containerStyle={this.props.inputContainerStyle}
                value={
                  this.props.formatValue
                    ? this.state.onSliderDraing
                      ? this.props.formatValue(this.state.localValue)
                      : this.props.formatValue(this.props.value)
                    : this.state.onSliderDraing
                    ? this.state.localValue
                    : processedValue
                }
                onChange={(value: string) => {
                  if (this.props.rawInputMiddleware) {
                    this.props.onChange(this.props.rawInputMiddleware(value));
                  } else {
                    this.props.onChange(Number(value));
                  }
                  this.setState({
                    onSliderDraing: false,
                  });
                }}
                small
                disabled={this.props.disabled}
                numberFixed={this.numberFixed}
              />
            </div>
          </>
        </div>
        {this.props.slider && (
          <div
            className={
              this.props.icon ? style.inputSliderWithIcon : style.inputSlider
            }
          >
            {this.props.icon && (
              <div
                className={calc_class_name(
                  style.inputSliderIconWrapper,
                  this.props.iconStyle,
                )}
                onClick={this.props.onIconClick}
              >
                <div className={this.props.icon} />
              </div>
            )}
            <Range
              value={
                this.state.onSliderDraing
                  ? this.state.localValue
                  : processedValue
              }
              onValueChange={(value: number) => {
                if (this.state.onSliderDraing == false) {
                  this.setState({
                    localValue: value,
                    onSliderDraing: true,
                  });
                } else {
                  this.setState({
                    localValue: value,
                  });
                }
                if (
                  this.props.throttlingDelay !== undefined &&
                  this.throttledOnChange
                ) {
                  this.throttledOnChange(value);
                }
              }}
              step={
                this.numberFixed > 0 ? 1 / Math.pow(10, this.numberFixed) : 1
              }
              min={this.props.slider[0]}
              max={this.props.slider[1]}
              disabled={this.props.disabled}
              dragEndCb={(value: number) => {
                this.props.onChange(value);
                this.setState(
                  {
                    localValue: value,
                  },
                  () => {
                    this.setState({ onSliderDraing: false });
                  },
                );
              }}
            />
          </div>
        )}
      </div>
    );
  }
}

interface RadioPropertyProps {
  name: string | React.ReactNode;
  value: boolean;
  disabled?: boolean;
  disabledStyle?: string;
  nameStyle?: React.CSSProperties;
  onChange: (value: boolean) => void;
  invisible?: boolean;
}

interface RadioPropertyState {}

export class RadioProperty extends React.Component<
  RadioPropertyProps,
  RadioPropertyState
> {
  constructor(props) {
    super(props);
  }

  public render() {
    if (this.props.invisible) return <></>;

    return (
      <div
        className={
          !this.props.disabled
            ? style.property
            : this.props.disabledStyle || style.propertyDisabled
        }
      >
        <div className={style.propertyWrapper}>
          <div className={style.propName} style={this.props.nameStyle}>
            {this.props.name}
          </div>
          <>
            <div className={style.propValue}>
              <RadioInput
                active={this.props.value}
                onChange={this.props.onChange}
                disabled={this.props.disabled}
              />
            </div>
          </>
        </div>
      </div>
    );
  }
}

interface SwitcherPropertyProps {
  name: string;
  value: number;
  switch: {
    id: number;
    text: string;
  }[];
  disabled?: boolean;
  disabledStyle?: string;
  nameStyle?: React.CSSProperties;
  onChange: (value: number) => void;
  onToggle?: (available: boolean) => void;
  invisible?: boolean;
}

interface SwitcherPropertyState {}

export class SwitcherProperty extends React.Component<
  SwitcherPropertyProps,
  SwitcherPropertyState
> {
  constructor(props) {
    super(props);
  }

  public render() {
    if (this.props.invisible) return <></>;

    return (
      <div
        className={
          !this.props.disabled
            ? style.property
            : this.props.disabledStyle || style.propertyDisabled
        }
      >
        <div className={style.propertyWrapper}>
          <div className={style.propName} style={this.props.nameStyle}>
            {this.props.name}
          </div>
          {
            <>
              {this.props.onToggle !== undefined &&
                this.props.disabled !== undefined && (
                  <RadioInput
                    active={!this.props.disabled}
                    onChange={(v) =>
                      this.props.onToggle && this.props.onToggle(v)
                    }
                  />
                )}
            </>
          }
        </div>
        <div className={style.switchWrapper}>
          <Switch
            currentOperation={+this.props.value}
            operationList={[...this.props.switch]}
            onChange={(e) => this.props.onChange(e)}
            disabled={this.props.disabled}
          />
        </div>
      </div>
    );
  }
}

interface CustomPropertyProps {
  children?: React.ReactNode;
  name: string;
  disabled?: boolean;
  disabledStyle?: string;
  nameStyle?: React.CSSProperties;
}

export class CustomProperty extends React.Component<CustomPropertyProps, {}> {
  constructor(props) {
    super(props);
  }

  public render() {
    return (
      <div
        className={
          !this.props.disabled
            ? style.property
            : this.props.disabledStyle || style.propertyDisabled
        }
      >
        <div className={style.propertyWrapper}>
          <div className={style.propName} style={this.props.nameStyle}>
            {this.props.name}
          </div>
          <>{this.props.children}</>
        </div>
      </div>
    );
  }
}

type RotationProps = {
  intl: IntlShape;
  rotation: quat;
  setRotation: (quat: quat, commit?: boolean) => void;
};

enum RotationDisplayMode {
  Quaternion,
  AxisAngle,
}

type RotationState = {
  rotationDisplayMode: RotationDisplayMode;
  euler_x: number;
  euler_y: number;
  euler_z: number;
  prev_quat: quat;
};

export class RotationPropertyComponent extends React.Component<
  RotationProps,
  RotationState
> {
  private backup_orientation: quat = quat.clone(this.props.rotation);
  private compute_orientation: quat = quat.clone(this.props.rotation);
  private _tempQuat = quat.create();
  private _quatEuler = quat.create();

  constructor(props) {
    super(props);
    this.state = {
      rotationDisplayMode: RotationDisplayMode.Quaternion,
      euler_x: 0,
      euler_y: 0,
      euler_z: 0,
      prev_quat: quat.clone(this.props.rotation),
    };
  }

  public componentWillUnmount() {
    if (
      this.state.euler_x != 0 ||
      this.state.euler_y != 0 ||
      this.state.euler_z != 0
    ) {
      this._applyEulerRotation(this._tempQuat);
    }
  }

  public static getDerivedStateFromProps(
    nextProps: RotationProps,
    prevState: RotationState,
  ) {
    const propsQuat = nextProps.rotation;
    const stateQuat = prevState.prev_quat;
    if (
      prevState[0] != stateQuat[0] ||
      prevState[1] != stateQuat[1] ||
      prevState[2] != stateQuat[2] ||
      prevState[3] != stateQuat[3]
    ) {
      return {
        prev_quat: propsQuat,
      };
    }
    return null;
  }

  private _applyEulerRotation = (q: quat) => {
    this.props.setRotation(q, true);
    this.setState({
      euler_x: 0,
      euler_y: 0,
      euler_z: 0,
    });
    quat.identity(this._quatEuler);
    quat.copy(this.compute_orientation, q);
  };

  private _resetRotation = () => {
    quat.identity(this._quatEuler);
    this.props.setRotation(this.backup_orientation);
    quat.copy(this.compute_orientation, this.backup_orientation);
    quat.identity(this._quatEuler);
    this.setState({
      euler_x: 0,
      euler_y: 0,
      euler_z: 0,
    });
  };

  private _handleEulerChange() {
    quat.fromEuler(
      this._quatEuler,
      this.state.euler_x,
      this.state.euler_y,
      this.state.euler_z,
    );
    quat.multiply(this._tempQuat, this.compute_orientation, this._quatEuler);
    quat.normalize(this._tempQuat, this._tempQuat);
    this.props.setRotation(this._tempQuat);
    quat.identity(this._quatEuler);
  }

  private _renderRotationDisplay = () => {
    const quaternion = this.state.prev_quat;
    if (this.state.rotationDisplayMode === RotationDisplayMode.Quaternion) {
      const x = quaternion[0].toFixed(3);
      const y = quaternion[1].toFixed(3);
      const z = quaternion[2].toFixed(3);
      const w = quaternion[3].toFixed(3);
      return (
        <div className={style.rotationDisplayWrapper}>
          <label style={{ fontSize: 'var(--text-h4)' }}>
            {this.props.intl.formatMessage({
              id: 'rotation_property_quaternion',
            })}
          </label>
          <Input
            value={`${x}, ${y}, ${z}, ${w}`}
            onChange={(v) => {
              const data = v.split(',');
              if (data.length === 4) {
                const q = quat.create();
                for (let i = 0; i < 4; i++) {
                  q[i] = Number(data[i]);
                  if (typeof q[i] !== 'number' || q[i].toString() == 'NaN') {
                    return;
                  }
                }
                this._applyEulerRotation(q);
              }
            }}
          />
        </div>
      );
    } else {
      const axisAngle = quatToAxisAngleForm(quaternion);
      axisAngle.axis[0] = Number(axisAngle.axis[0].toFixed(3));
      axisAngle.axis[1] = Number(axisAngle.axis[1].toFixed(3));
      axisAngle.axis[2] = Number(axisAngle.axis[2].toFixed(3));
      axisAngle.angle = Number(axisAngle.angle.toFixed(3));

      return (
        <div className={style.rotationDisplayWrapper}>
          <label style={{ fontSize: 'var(--text-h4)' }}>
            {this.props.intl.formatMessage({
              id: 'rotation_property_axis_angle',
            })}
          </label>
          <Input
            disabled
            value={axisAngle.axis.join(', ') + ', ' + axisAngle.angle}
            onChange={() => {}}
          />
        </div>
      );
    }
  };

  public render() {
    const disabledBtn =
      this.state.euler_x == 0 &&
      this.state.euler_y == 0 &&
      this.state.euler_z == 0;
    return (
      <>
        {this._renderRotationDisplay()}
        <Switch
          wrapperStyle={{
            margin: '8px 0',
            height: '32px',
            lineHeight: '31px',
          }}
          currentOperation={this.state.rotationDisplayMode}
          operationList={[
            {
              id: RotationDisplayMode.Quaternion,
              text: this.props.intl.formatMessage({ id: 'quaternion' }),
            },
            {
              id: RotationDisplayMode.AxisAngle,
              text: this.props.intl.formatMessage({ id: 'axisangle' }),
            },
          ]}
          onChange={(v) => {
            this.setState({ rotationDisplayMode: v });
          }}
          disabled={false}
        />
        <div className={style.rotationController}>
          <label style={{ fontSize: 'var(--text-h4)' }}>
            {this.props.intl.formatMessage({ id: 'euler_tool' })}
          </label>
          <NumberProperty
            name={'X'}
            numberFixed={0}
            value={this.state.euler_x}
            throttlingDelay={50}
            onChange={(v: number) => {
              if (
                this.state.euler_x == 0 &&
                this.state.euler_y == 0 &&
                this.state.euler_z == 0
              ) {
                this.backup_orientation = quat.clone(this.props.rotation);
                this.compute_orientation = quat.clone(this.props.rotation);
                console.log(this.backup_orientation);
              }
              this.setState(
                {
                  euler_x: v,
                },
                () => this._handleEulerChange(),
              );
            }}
            slider={[-180, 180]}
          />
          <NumberProperty
            name={'Y'}
            numberFixed={0}
            value={this.state.euler_y}
            throttlingDelay={50}
            onChange={(v: number) => {
              if (
                this.state.euler_x == 0 &&
                this.state.euler_y == 0 &&
                this.state.euler_z == 0
              ) {
                this.backup_orientation = quat.clone(this.props.rotation);
                this.compute_orientation = quat.clone(this.props.rotation);
                console.log(this.backup_orientation);
              }
              this.setState(
                {
                  euler_y: v,
                },
                () => this._handleEulerChange(),
              );
            }}
            slider={[-180, 180]}
          />
          <NumberProperty
            name={'Z'}
            numberFixed={0}
            value={this.state.euler_z}
            throttlingDelay={50}
            onChange={(v: number) => {
              if (
                this.state.euler_x == 0 &&
                this.state.euler_y == 0 &&
                this.state.euler_z == 0
              ) {
                this.backup_orientation = quat.clone(this.props.rotation);
                this.compute_orientation = quat.clone(this.props.rotation);
                console.log(this.backup_orientation);
              }
              this.setState(
                {
                  euler_z: v,
                },
                () => this._handleEulerChange(),
              );
            }}
            slider={[-180, 180]}
          />
          <div className={style.btnGrop}>
            <button
              className={[
                style.applyBtn,
                disabledBtn ? style.disabled : '',
              ].join(' ')}
              onClick={() => {
                this._applyEulerRotation(this._tempQuat);
              }}
            >
              {this.props.intl.formatMessage({ id: 'applyRotation' })}
            </button>
            <button
              className={[
                style.cancelBtn,
                disabledBtn ? style.disabled : '',
              ].join(' ')}
              onClick={this._resetRotation}
            >
              {this.props.intl.formatMessage({ id: 'cancel' })}
            </button>
          </div>
        </div>
      </>
    );
  }
}

export const RotationProperty = injectIntl(RotationPropertyComponent);

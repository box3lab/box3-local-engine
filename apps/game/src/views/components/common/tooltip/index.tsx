import * as React from 'react';
import { calc_class_name } from 'src/utils/classname';
import { touchable } from 'src/utils/mobile';

import styles from './index.module.css';

import type { JSX } from 'react';

type TooltipPlacement = 'top' | 'left' | 'right' | 'bottom';

type TooltipAlign = 'left' | 'right' | 'center';

interface BoundingClientRect {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
  x: number;
  y: number;
}

interface TooltipProps {
  children?: React.ReactNode;
  content: string | JSX.Element;
  visible?: boolean;
  // the place where the tooltip is
  placement?: TooltipPlacement;
  // align only work when placement is bottom or top
  align?: TooltipAlign;
  offset?: number;
  tooltipClass?: string;
  contentClass?: string;
  dismiss?: number;
  removeArrow?: boolean;
  style?: React.CSSProperties;
  onClick?: (arg?: unknown) => any;
}
class Tooltip extends React.Component<TooltipProps, any> {
  public static defaultProps = {
    placement: 'bottom' as TooltipPlacement,
    align: 'right' as TooltipAlign,
    offset: 10,
  };

  constructor(props: TooltipProps) {
    super(props);

    this.state = {
      visible: !!props.visible,
      style: {},
      arrowStyle: {},
      hidden: false,
    };
  }

  private tooltipRef = React.createRef<HTMLDivElement>();
  private containerRef = React.createRef<HTMLDivElement>();

  private timer: number = 0;

  public static getDerivedStateFromProps(nextProps: TooltipProps) {
    if ('visible' in nextProps) {
      return { visible: nextProps.visible };
    }
    return null;
  }

  public componentDidMount() {
    this.setState({
      style: this.getStyle(),
      arrowStyle: this.getArrowStyle(),
    });
    if (this.props.dismiss) {
      this.timer = window.setTimeout(() => {
        this.setState({
          hidden: true,
        });
      }, this.props.dismiss);
    }
  }

  public componentWillUnmount() {
    if (this.timer) {
      window.clearTimeout(this.timer);
    }
  }

  private getStyle = () => {
    const { offset = 10, align, placement } = this.props;
    const containerAttr = this.containerRef.current?.getBoundingClientRect();
    if (!containerAttr) {
      return {};
    }
    const { width, height } = containerAttr;
    const alignPosition: object =
      align === 'right' ? { right: 0 } : align === 'left' ? { left: 0 } : {};
    let placePosition: object = {};
    switch (placement) {
      case 'bottom': {
        placePosition = { top: height + offset };
        break;
      }
      case 'top': {
        placePosition = { top: -height - offset };
        break;
      }
      case 'left': {
        placePosition = { right: width + offset };
        break;
      }
      case 'right': {
        placePosition = { left: width + offset };
      }
    }
    return {
      ...alignPosition,
      ...placePosition,
    };
  };

  /*
   * because of arrow point to center, so we need to check whether the center of
   * container outside the tooltip
   */
  private checkIfOutside = (
    tooltipAttr: BoundingClientRect,
    containerAttr: BoundingClientRect,
    align: string,
  ) => {
    const { width: tooltipWidth } = tooltipAttr;
    const { width: containerWidth } = containerAttr;
    return tooltipWidth < containerWidth / 2;
  };

  private getArrowPosition = (
    tooltipAttr: BoundingClientRect,
    containerAttr: BoundingClientRect,
    align: string,
    placement: string,
  ) => {
    const { width: containerWidth } = containerAttr;
    const { width: tooltipWidth, height: tooltipHeight } = tooltipAttr;
    const arrowHalfWidthAndHeight = Math.sqrt(10 * 10 + 10 * 10) / 2;
    if (placement === 'bottom' || placement === 'top') {
      if (this.checkIfOutside(tooltipAttr, containerAttr, align)) {
        const position = tooltipWidth / 2 - arrowHalfWidthAndHeight;
        return {
          left: position,
          [placement]: `-${arrowHalfWidthAndHeight - 1}px`,
        };
      } else {
        // 10 is the width of arrow, check it in css file.
        if (align === 'center') {
          const position = tooltipWidth / 2 - arrowHalfWidthAndHeight;
          return {
            left: position,
            [placement]: `-${arrowHalfWidthAndHeight - 1}px`,
          };
        } else {
          const position: number = containerWidth / 2 - arrowHalfWidthAndHeight;
          return {
            [align]: position > 7 ? position : 7,
            [placement]: `-${arrowHalfWidthAndHeight - 1}px`,
          };
        }
      }
    } else {
      const position = tooltipHeight / 2 - arrowHalfWidthAndHeight;
      return {
        top: position,
        [placement]: `-${arrowHalfWidthAndHeight - 1}px`,
      };
    }
  };

  private getArrowDirection = (placement: string) => {
    switch (placement) {
      case 'bottom': {
        return {
          borderBottom: 'none',
          borderRight: 'none',
          transform: 'rotate(45deg)',
        };
      }
      case 'top': {
        return {
          borderLeft: 'none',
          borderTop: 'none',
          transform: 'rotate(45deg)',
        };
      }
      case 'left': {
        return {
          borderLeft: 'none',
          borderBottom: 'none',
          transform: 'rotate(45deg)',
        };
      }
      case 'right': {
        return {
          borderRight: 'none',
          borderTop: 'none',
          transform: 'rotate(45deg)',
        };
      }
    }
    return {};
  };

  private getArrowStyle = () => {
    const { align = 'right', placement = 'bottom' } = this.props;
    const tooltipAttr = this.tooltipRef.current?.getBoundingClientRect();
    const containerAttr = this.containerRef.current?.getBoundingClientRect();
    if (!tooltipAttr || !containerAttr) {
      return {};
    }
    const arrowPlacement: object = {
      bottom: 'top',
      top: 'bottom',
      left: 'right',
      right: 'left',
    };
    const arrowPlacementChange = arrowPlacement[placement];
    const arrowPosition: object = this.getArrowPosition(
      tooltipAttr,
      containerAttr,
      align,
      arrowPlacementChange,
    );
    const arrowStyle: object = this.getArrowDirection(placement);
    return {
      ...arrowStyle,
      ...arrowPosition,
    };
  };

  private onMouseEnter = (e) => {
    e.stopPropagation();
    if (this.props.dismiss) {
      return;
    }
    this.setState(
      {
        visible: true,
        style: this.getStyle(),
      },
      () => {
        this.setState({
          arrowStyle: this.getArrowStyle(),
        });
      },
    );
  };

  private onMouseLeave = (e) => {
    if (this.props.dismiss) {
      return;
    }
    e.stopPropagation();
    this.setState({
      visible: false,
    });
  };

  private handleClick = () => {
    this.props.onClick && this.props.onClick();
  };

  public render() {
    const { content, tooltipClass, contentClass } = this.props;
    const { visible, style, arrowStyle, hidden } = this.state;
    const children = this.props.children as React.ReactElement<any>;
    const child = React.isValidElement(children) ? (
      children
    ) : (
      <span>{children}</span>
    );
    const childProps = child.props;
    const childCls = calc_class_name(styles.tooltip, childProps.className);
    const tooltipCls = calc_class_name(
      styles.tooltipContent,
      tooltipClass,
      visible && !hidden ? styles.visible : styles.hidden,
    );
    return (
      <div
        ref={this.containerRef}
        className={childCls}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        {React.cloneElement(child, {
          ...childProps,
          className: contentClass,
        })}
        {content && (
          <div
            ref={this.tooltipRef}
            className={tooltipCls}
            style={style}
            onClick={() => (touchable ? false : this.handleClick())}
            onTouchStart={() => (touchable ? this.handleClick() : false)}
          >
            <div>{content}</div>
            {!this.props.removeArrow && (
              <div className={styles.tooltipArrow} style={arrowStyle}></div>
            )}
          </div>
        )}
      </div>
    );
  }
}

export default Tooltip;

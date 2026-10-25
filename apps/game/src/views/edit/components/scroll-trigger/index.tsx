import {
  ReactNode,
  Ref,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
  useRef,
} from 'react';

import { IconLoading } from '@box/icons';

import { debounce } from 'src/utils/debounce-throttle';

import style from './index.module.scss';

const OFFSET = 30;

export enum ScrollAction {
  setScrollHeight,
  getScrollHeight,
}

export type ScrollManage = {
  [ScrollAction.setScrollHeight]: (position: number) => void;
  [ScrollAction.getScrollHeight]: () => number;
};

type Props = {
  /** 触底后的回调 */
  loadMore?: () => void;
  /** children */
  children: ReactNode;
  containerClassName?: string;
  loading: boolean;
};
function ScrollTriggerView(props: Props, ref: Ref<ScrollManage>) {
  const { loadMore, children, containerClassName = '', loading } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(undefined);

  const className = useMemo(() => {
    const list: string[] = [style.scroll, containerClassName];

    return list.join(' ');
  }, [containerClassName]);

  // 设置滚动条高度
  const setScrollPosition = useCallback((position: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = position;
    }
  }, []);

  // 缓存滚动条高度
  const getScrollPosition = useCallback(() => {
    if (containerRef.current) {
      return containerRef.current.scrollTop;
    }
    return 0;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      [ScrollAction.setScrollHeight]: setScrollPosition,
      [ScrollAction.getScrollHeight]: getScrollPosition,
    }),
    [getScrollPosition, setScrollPosition],
  );

  const loadMoreDebounce = debounce(
    useCallback(() => {
      loadMore && loadMore();
    }, [loadMore]),
    300,
  );

  const loadingRef = useRef<boolean>(undefined);
  loadingRef.current = loading;
  const onScroll = useCallback(async () => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) {
      return;
    }

    // 如果是向上滚动则不执行滚动加载
    if (
      lastScrollTopRef.current &&
      container.scrollTop < lastScrollTopRef.current
    ) {
      lastScrollTopRef.current = container.scrollTop;
      return;
    }
    lastScrollTopRef.current = container.scrollTop;

    if (loadingRef.current) {
      return;
    }
    const distance =
      content.getBoundingClientRect().bottom -
      container.getBoundingClientRect().bottom;
    if (distance < OFFSET) {
      loadMoreDebounce();
    }
  }, [loadMoreDebounce]);
  return (
    <div className={className} ref={containerRef} onScroll={onScroll}>
      <div className={style.content} ref={contentRef}>
        {children}
        {loading && (
          <div className={style.footer}>
            <IconLoading className={style.loading} />
          </div>
        )}
      </div>
    </div>
  );
}

export default forwardRef<ScrollManage, Props>(ScrollTriggerView);

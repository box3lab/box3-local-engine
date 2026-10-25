import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { InputPauseFlags } from '@box/schema/input/input-schema';
import { InputPause, useInputPause } from '../../../components/input-lock';
import style from './index.module.scss';
import { IconSearch, IconCancel } from '@box/icons';
import { Input, InputSizes } from '@box/box-design';
import { useIntl } from 'react-intl';

type Props = {
  onSearch: (query: string) => void;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  onBlur?: () => void;
  clearBtn?: boolean;
  style?: React.CSSProperties;
  size: InputSizes;
  initialValue?: string;
};

type SearchHandle = {
  handleBlur: () => void;
};

function usePrevious(value: string) {
  const ref = useRef('');
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

function SearchFC(
  props: Props,
  ref: React.ForwardedRef<SearchHandle>,
) {
  const {
    size,
    value: optionValue,
    onChange,
    onSearch,
    initialValue = '',
  } = props;
  const intl = useIntl();
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState(initialValue);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchNow = useRef(false);
  const timer = useRef<number>(0);
  const currValue = useMemo(() => {
    return optionValue !== undefined ? optionValue : inputValue;
  }, [optionValue, inputValue]);
  const prevValue = usePrevious(currValue);

  const { inputPauseChange } = useInputPause();

  useEffect(() => {
    if (prevValue === currValue) {
      return;
    }

    if (timer.current) {
      clearTimeout(timer.current);
    }

    if (searchNow.current) {
      onSearch(currValue);
      searchNow.current = false;
      return;
    }

    timer.current = window.setTimeout(() => {
      onSearch(currValue);
    }, 500);
  }, [onSearch, currValue, prevValue]);

  const handleSearch = useCallback(
    (value: string, immediate: boolean = false) => {
      searchNow.current = immediate;
      setInputValue(value);
      onChange && onChange(value);
    },
    [onChange],
  );

  const _handleBlur = () => {
    props.onBlur && props.onBlur();
  };

  useImperativeHandle(ref, () => ({
    handleBlur: () => {
      inputRef.current?.blur();
    },
  }));

  return (
    <div
      className={[
        style.inputWrapper,
        isFocused ? style.isFocused : '',
        style[size],
      ].join(' ')}
      style={props.style}
    >
      {isFocused && (
        <InputPause flags={InputPauseFlags.ALL} change={inputPauseChange} />
      )}
      <Input
        ref={inputRef}
        className={style.input}
        value={currValue}
        placeholder={props.placeholder || intl.formatMessage({ id: 'search' })}
        prefix={
          <div className={style.searchIcon}>
            <IconSearch />
          </div>
        }
        suffix={
          (props.clearBtn && currValue.toString().length && (
            <div className={style.clearIcon}>
              <IconCancel
                onClick={() => {
                  handleSearch('', true);
                }}
              />
            </div>
          )) ||
          undefined
        }
        type="primary"
        size={size}
        valueType={'string'}
        onChange={handleSearch}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') {
            // 立即搜索
            if (timer.current) {
              clearTimeout(timer.current);
            }
            onSearch(currValue);
          }
          if (ev.key === 'Escape') {
            handleSearch('', true);
          }
        }}
        onFocus={() => {
          setIsFocused(true);
        }}
        onBlur={() => {
          setIsFocused(false);
          _handleBlur();
        }}
        onBlurValidator={() => true}
      />
    </div>
  );
};

export const Search = forwardRef<SearchHandle, Props>(SearchFC);

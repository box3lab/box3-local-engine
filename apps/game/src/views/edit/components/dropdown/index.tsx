import * as React from 'react';
import { useRef, useState } from 'react';
import arrayTreeFilter from './arrayTreeFilter';
import { useDeepCompareEffect } from 'src/utils/react-hooks/common';
import { Icon } from '../../../components/basic/icon';

import localStyle from './index.module.css';

type TypeMap<T extends DropDownDataValueType> = T extends number
  ? number
  : T extends string
  ? string
  : T extends boolean
  ? boolean
  : T;

export type DropDownDataValueType = string | number | boolean | null;

export type DropdownDataObject<T> = {
  label: string;
  value: T;
  children?: DropdownDataObject<T>[];
};

type DropdownProps<T> = {
  dropdownList: DropdownDataObject<T>[];
  maxHeight?: number;
  value?: T[]; // one mean only first level, array mean [first level's value, second level's value]
  onChange: (value: T[], selectOptions?: DropdownDataObject<T>[]) => void;
  className?: { [name: string]: string };
  containerClass?: string;
  dark?: boolean;
  disable?: boolean;
};

type DropdownStates = {
  isOpen: boolean;
};

export function Dropdown<T>(props: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<T[]>([]);
  const [placeholder, setPlaceHolder] = useState('');
  const dropdownElm = useRef<HTMLDivElement>(null);

  useDeepCompareEffect(() => {
    if (!props.value?.length) {
      return;
    }
    const value = getOption(props.dropdownList, props.value);
    setSelectedValue(value);
  }, [props.value, props.dropdownList]);

  useDeepCompareEffect(() => {
    const activeOptions = getActiveOptions(selectedValue);
    props.onChange(
      activeOptions.map((o) => o['value']),
      activeOptions,
    );
  }, [selectedValue]);

  const getOption = (list: DropdownDataObject<T>[], value: T[]) => {
    let tempList: DropdownDataObject<T>[] = [...list];
    const tempValue = [...value];
    const resultValue: T[] = [];
    while (tempValue.length) {
      const target = tempValue.shift();
      for (let i = 0; i < tempList.length; i++) {
        if (tempList[i].value === target) {
          resultValue.push(tempList[i].value);
          if (tempList[i].children?.length) {
            tempList = tempList[i].children || [];
          }
          setPlaceHolder(tempList[i].label);
          break;
        }
      }
    }
    return resultValue;
  };

  const getActiveOptions = (values: T[]) => {
    const { dropdownList } = props;
    return arrayTreeFilter(
      dropdownList,
      (o, level) => o['value'] === values[level],
    );
  };

  const handleOptionSelect = (
    targetOption: DropdownDataObject<T>,
    menuIndex: number,
  ) => {
    if (!targetOption) {
      return;
    }
    let tempSelectedValue = [...selectedValue];
    tempSelectedValue = tempSelectedValue.slice(0, menuIndex + 1);
    tempSelectedValue[menuIndex] = targetOption['value'];
    if (!targetOption['children'] || !targetOption['children'].length) {
      setIsOpen(false);
      setPlaceHolder(targetOption.label);
    }
    setSelectedValue(tempSelectedValue);
  };

  const renderOptionColumn = () => {
    const { dropdownList } = props;
    const result = getActiveOptions(selectedValue)
      .map((option) => option['children'])
      .filter((option) => !!option);
    result.unshift(dropdownList);
    return (
      <>
        {result.map((options, index) => (
          <div
            className={
              result.length > 1 ? style.optionMultiColumn : style.optionColumn
            }
            key={index}
          >
            {options?.map((option, i) => (
              <div
                className={style.dropdownOption}
                style={
                  option['value'] === selectedValue[index]
                    ? { color: '#FFAF00' }
                    : {}
                }
                key={i}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOptionSelect(option, index);
                }}
              >
                {option.label}
              </div>
            ))}
          </div>
        ))}
      </>
    );
  };

  const style = props.className || localStyle;
  return (
    <div
      className={
        props.containerClass ? props.containerClass : style.dropdownContainer
      }
      ref={dropdownElm}
    >
      <div
        className={
          props.disable ? style.dropdownValueDisable : style.dropdownValue
        }
        onClick={() => !props.disable && setIsOpen(true)}
      >
        {placeholder}
        <div className={style.dropdownTriangle}>
          <Icon
            icon="arrow-down"
            className={
              isOpen ? style.dropdownTriangleUp : style.dropdownTriangleDown
            }
          />
        </div>
      </div>
      {isOpen ? (
        <div
          className={style.dropdownMask}
          onClick={() => setIsOpen(false)}
        ></div>
      ) : (
        ''
      )}
      {isOpen && (
        <div
          className={props.dark ? style.optionsDark : style.options}
          style={{
            width: dropdownElm.current
              ? dropdownElm.current.clientWidth
              : 'auto',
          }}
        >
          <div
            className={style.optionsMask}
            style={props.maxHeight ? { maxHeight: props.maxHeight + 'px' } : {}}
          >
            {renderOptionColumn()}
          </div>
        </div>
      )}
    </div>
  );
}

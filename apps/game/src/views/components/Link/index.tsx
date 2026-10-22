import React from 'react';
import { LinkProps } from 'react-router-dom';

// 此项目没有react-router
function useLink(props: LinkProps) {
  let label = '';
  let isExternal = false;
  let rel = '';
  if (typeof props.to === 'string') {
    label = props.to;
    if (/^http/.test(props.to)) {
      isExternal = true;
      rel = 'noopener noreferrer';
    }
  } else {
    label = props.to['pathname'] || '';
  }
  return {
    linkProps: {
      label,
      className: props.className,
      onClick: props.onClick,
      style: props.style,
      ['aria-label']: label,
      target: props.target,
      rel,
    },
    isExternal,
  };
}

export const Anchor = React.memo((props: LinkProps) => {
  const { linkProps } = useLink(props);
  return (
    <a {...linkProps} href={linkProps.label}>
      {props.children}
    </a>
  );
});

// auto detect and use correct link component
export let Link = React.memo((props: LinkProps) => {
  // should only be called once
  Link = Anchor;
  return <Link {...props} />;
});

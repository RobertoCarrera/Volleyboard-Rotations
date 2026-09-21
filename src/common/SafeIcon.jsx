import React from 'react';
import * as FiIcons from 'react-icons/fi';
import * as FaIcons from 'react-icons/fa';
import {FiAlertTriangle} from 'react-icons/fi';

const {FaVolleyballBall} = FaIcons;

const SafeIcon = ({
  icon,
  name,
  fallback,
  ...props
}) => {
  let IconComponent;

  try {
    IconComponent = icon || (name && FiIcons[`Fi${name}`]);
  } catch (error) {
    IconComponent = null;
  }

  const FallbackIcon = fallback === 'volleyball'
    ? FaVolleyballBall
    : FiAlertTriangle;

  return React.createElement(
    IconComponent || FallbackIcon,
    props
  );
};

export default SafeIcon;
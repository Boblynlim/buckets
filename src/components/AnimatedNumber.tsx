import React, { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  decimals?: number;
  style?: React.CSSProperties;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  prefix = '$',
  decimals = 2,
  style,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    prevValue.current = value;

    // Skip animation if it's the first render or values are equal
    if (from === to) {
      if (ref.current) {
        ref.current.textContent = `${prefix}${to.toFixed(decimals)}`;
      }
      return;
    }

    const controls = animate(from, to, {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate(latest) {
        if (ref.current) {
          ref.current.textContent = `${prefix}${latest.toFixed(decimals)}`;
        }
      },
    });

    return () => controls.stop();
  }, [value, prefix, decimals]);

  return (
    <span ref={ref} style={style}>
      {prefix}{value.toFixed(decimals)}
    </span>
  );
};

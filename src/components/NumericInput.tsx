/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';

export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string;
  onChange: (val: number, rawStr: string) => void;
  allowDecimals?: boolean;
  min?: number;
  max?: number;
  step?: string | number;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  allowDecimals = true,
  min,
  max,
  step,
  className = '',
  placeholder = '0',
  onFocus,
  onBlur,
  ...restProps
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isFirstClickRef = useRef(false);
  const [isFocused, setIsFocused] = useState(false);

  // Compute standard display value
  const getCleanDisplay = (v: number | string | undefined): string => {
    if (v === undefined || v === null || v === '' || Number.isNaN(Number(v))) {
      return '0';
    }
    return String(v);
  };

  const [displayVal, setDisplayVal] = useState<string>(() => getCleanDisplay(value));

  // Sync with prop when not actively focused
  useEffect(() => {
    if (!isFocused) {
      setDisplayVal(getCleanDisplay(value));
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    isFirstClickRef.current = true;

    // Trigger select immediately
    e.currentTarget.select();

    // Mobile / touch safeguard: Ensure selection persists after touch-up
    setTimeout(() => {
      if (inputRef.current && document.activeElement === inputRef.current) {
        inputRef.current.select();
      }
    }, 25);

    if (onFocus) {
      onFocus(e);
    }
  };

  const handleMouseDown = () => {
    if (document.activeElement !== inputRef.current) {
      isFirstClickRef.current = true;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    if (isFirstClickRef.current) {
      isFirstClickRef.current = false;
      e.preventDefault();
      inputRef.current?.select();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayVal(raw);

    if (raw.trim() === '' || raw === '-') {
      // User cleared the field or typed minus: treat as 0 for live calculations
      onChange(0, raw);
      return;
    }

    const parsed = allowDecimals ? parseFloat(raw) : parseInt(raw, 10);
    if (!isNaN(parsed)) {
      let constrained = parsed;
      if (min !== undefined && constrained < min) constrained = min;
      if (max !== undefined && constrained > max) constrained = max;
      onChange(constrained, raw);
    } else {
      onChange(0, raw);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    isFirstClickRef.current = false;

    // If user leaves the field blank or NaN, treat as 0 and display 0
    const trimmed = displayVal.trim();
    if (trimmed === '' || isNaN(Number(trimmed))) {
      setDisplayVal('0');
      onChange(0, '0');
    } else {
      const parsed = allowDecimals ? parseFloat(trimmed) : parseInt(trimmed, 10);
      let finalVal = isNaN(parsed) ? 0 : parsed;
      if (min !== undefined && finalVal < min) finalVal = min;
      if (max !== undefined && finalVal > max) finalVal = max;
      setDisplayVal(String(finalVal));
      onChange(finalVal, String(finalVal));
    }

    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <input
      ref={inputRef}
      type="number"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      step={step ?? (allowDecimals ? 'any' : '1')}
      min={min}
      max={max}
      value={displayVal}
      onChange={handleChange}
      onFocus={handleFocus}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      {...restProps}
    />
  );
};

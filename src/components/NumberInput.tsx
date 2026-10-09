import { useEffect, useState, type FocusEvent, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  value: number;
  onChange: (value: number) => void;
  /** Round to integer on commit (blur). */
  integer?: boolean;
};

const PARTIAL = /^-?\d*\.?\d*$/;

function commitValue(text: string, value: number, min?: number, max?: number, integer?: boolean): number {
  const trimmed = text.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === '.') return value;
  let n = integer ? parseInt(trimmed, 10) : parseFloat(trimmed);
  if (Number.isNaN(n)) return value;
  if (min != null) n = Math.max(min, n);
  if (max != null) n = Math.min(max, n);
  return n;
}

function textFromValue(n: number): string {
  return String(n);
}

/**
 * Mobile-friendly numeric field: you can clear the box and retype without snapping to 0 on every delete.
 * Uses text + decimal keyboard; commits on blur if left empty (keeps last value).
 */
export function NumberInput({
  value,
  onChange,
  min: minProp,
  max: maxProp,
  step: _step,
  integer,
  className,
  readOnly,
  disabled,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const min = minProp != null && minProp !== '' ? Number(minProp) : undefined;
  const max = maxProp != null && maxProp !== '' ? Number(maxProp) : undefined;
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => textFromValue(value));

  useEffect(() => {
    if (!focused) setText(textFromValue(value));
  }, [value, focused]);

  if (readOnly || disabled) {
    return (
      <input
        type="text"
        readOnly={readOnly}
        disabled={disabled}
        className={className}
        value={textFromValue(value)}
        {...rest}
      />
    );
  }

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    setText(textFromValue(value));
    onFocus?.(e);
    requestAnimationFrame(() => e.target.select());
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    const next = commitValue(text, value, min, max, integer);
    onChange(next);
    setText(textFromValue(next));
    onBlur?.(e);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      className={className}
      value={focused ? text : textFromValue(value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== '' && !PARTIAL.test(raw)) return;
        setText(raw);
        if (raw === '' || raw === '-' || raw === '.') return;
        let n = integer ? parseInt(raw, 10) : parseFloat(raw);
        if (Number.isNaN(n)) return;
        if (min != null) n = Math.max(min, n);
        if (max != null) n = Math.min(max, n);
        onChange(n);
      }}
    />
  );
}

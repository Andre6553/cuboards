import { useEffect, useRef, useState } from 'react';
import { normalizeSupplierName, supplierNameInList } from '../lib/materialSupplierPrices';

interface Props {
  value: string;
  knownNames: string[];
  onChange: (name: string) => void;
}

/** Pick a remembered supplier or type a new one. */
export function SupplierNamePick({ value, knownNames, onChange }: Props) {
  const trimmed = value.trim();
  const [enterCustom, setEnterCustom] = useState(() => Boolean(trimmed && !supplierNameInList(knownNames, trimmed)));
  const inputRef = useRef<HTMLInputElement>(null);

  const matched = !enterCustom && trimmed && supplierNameInList(knownNames, trimmed);
  const inCustomMode = enterCustom || Boolean(trimmed && !matched);

  useEffect(() => {
    if (inCustomMode) {
      inputRef.current?.focus();
    }
  }, [inCustomMode]);

  const commitNormalized = () => {
    const normalized = normalizeSupplierName(value);
    if (normalized !== value) onChange(normalized);
  };

  if (knownNames.length === 0) {
    return (
      <input
        className="table-input"
        value={value}
        placeholder="e.g. Gelmar"
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onBlur={commitNormalized}
        onKeyDown={(e) => e.stopPropagation()}
      />
    );
  }

  if (inCustomMode) {
    return (
      <div className="supplier-name-pick supplier-name-pick--custom">
        <input
          ref={inputRef}
          className="table-input"
          value={value}
          placeholder="Type new supplier name"
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onBlur={commitNormalized}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          className="supplier-name-pick-back"
          onClick={() => {
            setEnterCustom(false);
            if (!matched) onChange('');
          }}
        >
          Choose saved supplier
        </button>
      </div>
    );
  }

  return (
    <div className="supplier-name-pick">
      <select
        className="table-input table-select"
        value={matched ? knownNames.find((k) => k.toLowerCase() === trimmed.toLowerCase())! : ''}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__custom__') {
            (e.target as HTMLSelectElement).blur();
            setEnterCustom(true);
            return;
          }
          setEnterCustom(false);
          onChange(v);
        }}
      >
        <option value="">— Select supplier —</option>
        {knownNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
        <option value="__custom__">+ Add new supplier…</option>
      </select>
    </div>
  );
}

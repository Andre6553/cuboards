import { useEffect, useState } from 'react';
import { supplierNameInList } from '../lib/materialSupplierPrices';

interface Props {
  value: string;
  knownNames: string[];
  onChange: (name: string) => void;
}

/** Pick a remembered supplier or type a new one. */
export function SupplierNamePick({ value, knownNames, onChange }: Props) {
  const trimmed = value.trim();
  const matched = trimmed && supplierNameInList(knownNames, trimmed);
  const [enterCustom, setEnterCustom] = useState(() => Boolean(trimmed && !matched));

  useEffect(() => {
    if (matched) setEnterCustom(false);
    else if (trimmed && !matched) setEnterCustom(true);
  }, [matched, trimmed]);

  if (knownNames.length === 0) {
    return (
      <input
        className="table-input"
        value={value}
        placeholder="e.g. Gelmar"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const selectValue = matched
    ? knownNames.find((k) => k.toLowerCase() === trimmed.toLowerCase())!
    : enterCustom || trimmed
      ? '__custom__'
      : '';

  const showCustomInput = enterCustom || Boolean(trimmed && !matched);

  return (
    <div className="supplier-name-pick">
      <select
        className="table-input table-select"
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__custom__') {
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
      {showCustomInput ? (
        <input
          className="table-input supplier-name-pick-custom"
          value={value}
          placeholder="Type new supplier name"
          autoFocus={enterCustom && !trimmed}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </div>
  );
}

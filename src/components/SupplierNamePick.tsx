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
  const selectValue = matched
    ? knownNames.find((k) => k.toLowerCase() === trimmed.toLowerCase())!
    : trimmed
      ? '__custom__'
      : '';

  const showCustomInput = knownNames.length === 0 || selectValue === '__custom__';

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

  return (
    <div className="supplier-name-pick">
      <select
        className="table-input table-select"
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__custom__') {
            if (!trimmed) onChange('');
            return;
          }
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
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </div>
  );
}

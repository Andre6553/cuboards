import { useState } from 'react';
import type { HandleCount, Job, PartHandle } from '../types';
import { formatMoney } from '../lib/currency';
import {
  DEFAULT_HANDLE_COUNT,
  HANDLE_COUNT_OPTIONS,
  handleDisplayName,
  isUsingJobDefaultHandle,
  resolveHandleCatalogEntry,
  resolveHandleCount,
  resolveHandlePriceEach,
} from '../lib/handleRules';
import { HandlePickerDashboard } from './HandlePickerDashboard';

interface Props {
  job: Job;
  handle?: PartHandle;
  handleCount?: HandleCount;
  /** e.g. "door leaf" or "drawer front" */
  countLabel: string;
  onChange: (patch: { handle?: PartHandle; handleCount?: HandleCount }) => void;
}

export function HandleAssignmentControls({
  job,
  handle,
  handleCount,
  countLabel,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const count = resolveHandleCount(handleCount);
  const entry = resolveHandleCatalogEntry(handle, job);
  const price = resolveHandlePriceEach(handle, job);
  const usingJobDefault = isUsingJobDefaultHandle(handle);
  const name = handleDisplayName(handle, job);
  const resolvedId =
    handle?.type === 'preset'
      ? handle.presetId
      : usingJobDefault
        ? job.settings.defaultHandleId
        : undefined;

  return (
    <div className="handle-unit-row">
      <label>
        Handles / {countLabel}
        <select
          value={count}
          onChange={(e) => onChange({ handleCount: Number(e.target.value) as HandleCount })}
        >
          {HANDLE_COUNT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="field-hint">Default {DEFAULT_HANDLE_COUNT}.</span>
      </label>

      <div className="handle-unit-preview">
        {entry?.imageUrl ? <img src={entry.imageUrl} alt="" /> : null}
        <div className="handle-summary-text">
          <div className="handle-summary-name">{name}</div>
          <div className="handle-summary-meta">
            {usingJobDefault ? 'Job default' : 'Override'}
            {entry?.sku ? ` · SKU ${entry.sku}` : ''}
            {price > 0 ? ` · ${formatMoney(price, job.settings)} each` : ''}
            {!resolvedId && usingJobDefault ? ' — set a default in Job settings' : ''}
          </div>
        </div>
      </div>

      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        {resolvedId ? 'Change handle…' : 'Choose handle…'}
      </button>
      {!usingJobDefault && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onChange({ handle: { type: 'job_default' } })}
        >
          Use job default
        </button>
      )}

      {open && (
        <HandlePickerDashboard
          job={job}
          selectedId={resolvedId}
          title={`Choose handle for this ${countLabel}`}
          onCancel={() => setOpen(false)}
          onDone={(id) => {
            onChange({ handle: { type: 'preset', presetId: id } });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

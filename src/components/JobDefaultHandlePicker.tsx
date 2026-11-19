import { useState } from 'react';
import type { HandlePrices, HardwarePricing, Job, JobSettings } from '../types';
import { DEFAULT_INSTALL_RATES, DEFAULT_MASONITE, DEFAULT_PLASTIC_KICKPLATE } from '../lib/constants';
import { DEFAULT_HARDWARE_PRICING, getHandleByIdForJob, resolveHandleUnitPrice } from '../lib/hardwarePricing';
import { HandlePickerDashboard } from './HandlePickerDashboard';

interface Props {
  settings: JobSettings;
  onSettingsChange: (settings: JobSettings) => void;
  hardwarePricing: HardwarePricing;
  handlePrices: HandlePrices;
  formatPrice: (n: number) => string;
}

/** Minimal job shape so catalog helpers resolve Gelmar vs custom handles. */
function jobStub(
  settings: JobSettings,
  hardwarePricing: HardwarePricing,
  handlePrices: HandlePrices,
): Job {
  return {
    id: 'handle-picker',
    createdAt: '',
    updatedAt: '',
    client: { name: '', phone: '', address: '', ref: '', notes: '' },
    settings,
    materials: [],
    edgingMaterials: [],
    masonite: { ...DEFAULT_MASONITE },
    plasticKickplate: { ...DEFAULT_PLASTIC_KICKPLATE },
    runnerPrices: {},
    hingePrices: {},
    handlePrices,
    screwPrices: {},
    connectingFittingPrices: {},
    installRates: { ...DEFAULT_INSTALL_RATES, enabled: false },
    hardwarePricing: hardwarePricing ?? DEFAULT_HARDWARE_PRICING,
    units: [],
  };
}

export function JobDefaultHandlePicker({
  settings,
  onSettingsChange,
  hardwarePricing,
  handlePrices,
  formatPrice,
}: Props) {
  const [open, setOpen] = useState(false);
  const job = jobStub(settings, hardwarePricing, handlePrices);
  const selected = getHandleByIdForJob(job, settings.defaultHandleId);
  const price = selected ? resolveHandleUnitPrice(job, selected.id) : 0;

  return (
    <>
      <div className="handle-summary">
        {selected?.imageUrl ? (
          <img className="handle-summary-thumb" src={selected.imageUrl} alt="" />
        ) : (
          <div className="handle-summary-thumb handle-summary-thumb--empty" aria-hidden>
            {selected ? '—' : 'None'}
          </div>
        )}
        <div className="handle-summary-text">
          {selected ? (
            <>
              <div className="handle-summary-name">{selected.name}</div>
              <div className="handle-summary-meta">
                {selected.sku ? `SKU ${selected.sku} · ` : ''}
                {formatPrice(price)} each
              </div>
            </>
          ) : (
            <>
              <div className="handle-summary-name">No default handle</div>
              <div className="handle-summary-meta">Browse the catalog to pick one for this job.</div>
            </>
          )}
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          Browse handles…
        </button>
        {selected && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onSettingsChange({ ...settings, defaultHandleId: undefined })}
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <HandlePickerDashboard
          job={job}
          selectedId={settings.defaultHandleId}
          title="Choose job default handle"
          onCancel={() => setOpen(false)}
          onDone={(id) => {
            onSettingsChange({ ...settings, defaultHandleId: id });
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

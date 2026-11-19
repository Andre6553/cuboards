import { useState } from 'react';
import type { HandlePrices, HardwarePricing, Job, JobSettings } from '../types';
import { DEFAULT_INSTALL_RATES, DEFAULT_MASONITE, DEFAULT_PLASTIC_KICKPLATE } from '../lib/constants';
import {
  DEFAULT_HARDWARE_PRICING,
  getHandleByIdForJob,
  resolveHandleUnitPrice,
  usesGelmarCatalog,
} from '../lib/hardwarePricing';
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
  const useGelmar = usesGelmarCatalog(job, 'handles');
  const customHandles = hardwarePricing.customCatalog?.handles ?? [];
  const selectedId = settings.defaultHandleId ?? '';
  const customSelectValue = customHandles.some((h) => h.id === selectedId) ? selectedId : '';
  const selected = selectedId ? getHandleByIdForJob(job, selectedId) : undefined;
  const price = selected ? resolveHandleUnitPrice(job, selected.id) : 0;

  const setDefaultHandleId = (id: string | undefined) =>
    onSettingsChange({ ...settings, defaultHandleId: id || undefined });

  if (!useGelmar) {
    const customSelected = customSelectValue
      ? customHandles.find((h) => h.id === customSelectValue)
      : undefined;
    return (
      <div className="handle-summary handle-summary--custom">
        <div className="handle-summary-thumb handle-summary-thumb--empty" aria-hidden>
          {customSelected ? '—' : 'None'}
        </div>
        <div className="handle-summary-text" style={{ flex: '1 1 16rem' }}>
          <label>
            Job default handle
            <select
              value={customSelectValue}
              onChange={(e) => setDefaultHandleId(e.target.value || undefined)}
            >
              <option value="">No Handle</option>
              {customHandles.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.description?.trim() || 'Handle'}
                  {h.unitPrice > 0 ? ` · ${formatPrice(h.unitPrice)}` : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="hint" style={{ margin: '0.35rem 0 0' }}>
            {customHandles.length === 0
              ? 'Add your own handles under Handle prices (Gelmar catalog off), then pick one here. No Handle = no handles on the cut list.'
              : customSelected
                ? `${formatPrice(customSelected.unitPrice)} each · used on doors and drawer fronts unless a unit overrides.`
                : 'No Handle — this job will not add handles to Hardware.'}
          </p>
        </div>
      </div>
    );
  }

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
              <div className="handle-summary-name">No Handle</div>
              <div className="handle-summary-meta">
                Browse the Gelmar catalog, or leave as No Handle so this job adds none.
              </div>
            </>
          )}
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          Browse handles…
        </button>
        {selected && (
          <button type="button" className="btn btn-secondary" onClick={() => setDefaultHandleId(undefined)}>
            No Handle
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
            setDefaultHandleId(id);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

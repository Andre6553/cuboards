import { useState } from 'react';
import type { Job } from '../types';
import { createDefaultUnit } from '../lib/calculator';
import { loadPresets, unitFromPreset } from '../lib/presets';
import { ClientForm } from './ClientForm';
import { MaterialsForm } from './MaterialsForm';
import { PriceListBar } from './PriceListBar';
import { PresetPicker, UnitForm } from './UnitForm';
import { CutListView } from './CutListView';

interface Props {
  job: Job;
  onChange: (job: Job) => void;
  onBack: () => void;
}

type Tab = 'units' | 'prices' | 'cutlist';

export function JobEditor({ job, onChange, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('units');
  const activeUnitCount = job.units.filter((u) => (u.unitQty ?? 0) > 0).length;
  const savedAt = new Date(job.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const addUnit = () => {
    onChange({ ...job, units: [...job.units, createDefaultUnit(job, job.units.length)] });
  };

  const addFromPreset = (presetId: string) => {
    const preset = loadPresets().find((p) => p.id === presetId);
    if (!preset) return;
    const unit = unitFromPreset(preset);
    onChange({ ...job, units: [...job.units, unit] });
  };

  const removeUnit = (id: string, name: string) => {
    if (!confirm(`Remove "${name || 'this unit'}" from the job? This can't be undone.`)) return;
    onChange({ ...job, units: job.units.filter((u) => u.id !== id) });
  };

  return (
    <div className="job-editor">
      <header className="page-header">
        <div>
          <button type="button" className="btn btn-ghost back-btn" onClick={onBack}>← Jobs</button>
          <h1>{job.client.name || 'Untitled job'}</h1>
          <p className="subtitle">
            {job.client.ref && `Ref: ${job.client.ref} · `}
            <span className="saved-indicator">Saved on this device {savedAt}</span>
          </p>
        </div>
        <div className="tab-bar">
          <button type="button" className={`tab ${tab === 'units' ? 'active' : ''}`} onClick={() => setTab('units')}>
            Units ({activeUnitCount})
          </button>
          <button type="button" className={`tab ${tab === 'prices' ? 'active' : ''}`} onClick={() => setTab('prices')}>
            Prices &amp; settings
          </button>
          <button type="button" className={`tab ${tab === 'cutlist' ? 'active' : ''}`} onClick={() => setTab('cutlist')}>
            Cut list
          </button>
        </div>
      </header>

      {tab === 'units' && (
        <>
          <ClientForm
            client={job.client}
            onChange={(client) => onChange({ ...job, client })}
            defaultOpen={!job.client.name}
          />

          <section className="card units-card">
            <div className="units-header">
              <h2>Units <span className="units-count">{activeUnitCount} on cut list · {job.units.length} configured</span></h2>
              <div className="units-toolbar">
                <PresetPicker onSelect={addFromPreset} />
                <button type="button" className="btn btn-primary btn-sm" onClick={addUnit}>+ Add unit</button>
              </div>
            </div>
            {job.units.length === 0 && (
              <p className="hint">No units yet. Click <strong>+ Add unit</strong> (or pick a saved preset) to start the cut list.</p>
            )}
          </section>

          {job.units.map((unit) => (
            <UnitForm
              key={unit.id}
              unit={unit}
              materials={job.materials}
              edgingMaterials={job.edgingMaterials}
              settings={job.settings}
              onChange={(updated) =>
                onChange({ ...job, units: job.units.map((u) => (u.id === unit.id ? updated : u)) })
              }
              onRemove={() => removeUnit(unit.id, unit.name)}
            />
          ))}

          {job.units.length > 0 && (
            <div className="units-footer">
              <button type="button" className="btn btn-secondary" onClick={addUnit}>+ Add another unit</button>
              <button type="button" className="btn btn-primary" onClick={() => setTab('cutlist')}>View cut list →</button>
            </div>
          )}
        </>
      )}

      {tab === 'prices' && (
        <>
          <PriceListBar job={job} onChange={onChange} />
          <MaterialsForm
            materials={job.materials}
            edgingMaterials={job.edgingMaterials}
            masonite={job.masonite}
            plasticKickplate={job.plasticKickplate}
            runnerPrices={job.runnerPrices}
            hingePrices={job.hingePrices}
            screwPrices={job.screwPrices}
            connectingFittingPrices={job.connectingFittingPrices}
            installRates={job.installRates}
            settings={job.settings}
            onMaterialsChange={(materials) => onChange({ ...job, materials })}
            onEdgingChange={(edgingMaterials) => onChange({ ...job, edgingMaterials })}
            onMasoniteChange={(masonite) => onChange({ ...job, masonite })}
            onPlasticKickplateChange={(plasticKickplate) => onChange({ ...job, plasticKickplate })}
            onRunnerPricesChange={(runnerPrices) => onChange({ ...job, runnerPrices })}
            onHingePricesChange={(hingePrices) => onChange({ ...job, hingePrices })}
            onScrewPricesChange={(screwPrices) => onChange({ ...job, screwPrices })}
            onConnectingFittingPricesChange={(connectingFittingPrices) => onChange({ ...job, connectingFittingPrices })}
            onInstallRatesChange={(installRates) => onChange({ ...job, installRates })}
            onSettingsChange={(settings) => onChange({ ...job, settings })}
          />
        </>
      )}

      {tab === 'cutlist' && <CutListView job={job} />}
    </div>
  );
}

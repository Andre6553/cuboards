import { useState } from 'react';
import type { Job } from '../types';
import { DEFAULT_QUOTE_TERMS } from '../lib/constants';
import { resolveHardwarePricing } from '../lib/hardwarePricing';
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
  onPrefsSaved?: () => void;
  /** Persist account defaults onto every job; returns the updated list. */
  onSaveDefaultsAcrossJobs: (sourceJob: Job) => Job[];
  totalJobCount?: number;
  onSyncBoardMaterialsToAllJobs?: () => { updatedCount: number; totalJobs: number };
  onSyncEdgingToAllJobs?: () => { updatedCount: number; totalJobs: number };
}

type Tab = 'units' | 'prices' | 'cutlist';

export function JobEditor({
  job,
  onChange,
  onBack,
  onPrefsSaved,
  onSaveDefaultsAcrossJobs,
  totalJobCount,
  onSyncBoardMaterialsToAllJobs,
  onSyncEdgingToAllJobs,
}: Props) {
  const [tab, setTab] = useState<Tab>('units');
  const [unitsCollapseGeneration, setUnitsCollapseGeneration] = useState(0);
  const activeUnitCount = job.units.filter((u) => (u.unitQty ?? 0) > 0).length;

  const selectTab = (next: Tab) => {
    if (tab === 'units' && next !== 'units') {
      setUnitsCollapseGeneration((g) => g + 1);
    }
    setTab(next);
  };

  const collapseAllUnits = () => setUnitsCollapseGeneration((g) => g + 1);

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
        </div>
        <div className="page-header-tab-cluster">
          {tab === 'units' && job.units.length > 0 && (
            <button type="button" className="btn btn-secondary btn-sm collapse-all-units-btn" onClick={collapseAllUnits}>
              Collapse all units
            </button>
          )}
          <div className="tab-bar">
            <button type="button" className={`tab ${tab === 'units' ? 'active' : ''}`} onClick={() => selectTab('units')}>
              Units ({activeUnitCount})
            </button>
            <button type="button" className={`tab ${tab === 'prices' ? 'active' : ''}`} onClick={() => selectTab('prices')}>
              Prices &amp; settings
            </button>
            <button type="button" className={`tab ${tab === 'cutlist' ? 'active' : ''}`} onClick={() => selectTab('cutlist')}>
              Cut list
            </button>
          </div>
        </div>
      </header>

      {tab === 'units' && (
        <>
          <ClientForm
            key={job.id}
            client={job.client}
            onChange={(client) => onChange({ ...job, client })}
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
              job={job}
              unit={unit}
              materials={job.materials}
              edgingMaterials={job.edgingMaterials}
              settings={job.settings}
              unitsCollapseGeneration={unitsCollapseGeneration}
              onChange={(updated) =>
                onChange({ ...job, units: job.units.map((u) => (u.id === unit.id ? updated : u)) })
              }
              onRemove={() => removeUnit(unit.id, unit.name)}
            />
          ))}

          {job.units.length > 0 && (
            <div className="units-footer">
              <button type="button" className="btn btn-secondary" onClick={addUnit}>+ Add another unit</button>
              <div className="units-footer-actions">
                <button type="button" className="btn btn-secondary" onClick={collapseAllUnits}>
                  Collapse all units
                </button>
                <button type="button" className="btn btn-primary" onClick={() => selectTab('cutlist')}>
                  View cut list →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'prices' && (
        <>
          <PriceListBar
            job={job}
            onChange={onChange}
            onSaveDefaultsAcrossJobs={onSaveDefaultsAcrossJobs}
            onPrefsSaved={onPrefsSaved}
          />
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
            hardwarePricing={resolveHardwarePricing(job)}
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
            quoteTerms={{ ...DEFAULT_QUOTE_TERMS, ...job.quoteTerms }}
            onQuoteTermsChange={(quoteTerms) => onChange({ ...job, quoteTerms })}
            onHardwarePricingChange={(hardwarePricing) => onChange({ ...job, hardwarePricing })}
            totalJobCount={totalJobCount}
            onSyncBoardMaterialsToAllJobs={onSyncBoardMaterialsToAllJobs}
            onSyncEdgingToAllJobs={onSyncEdgingToAllJobs}
          />
        </>
      )}

      {tab === 'cutlist' && <CutListView job={job} />}
    </div>
  );
}

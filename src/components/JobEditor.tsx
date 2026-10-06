import { useState } from 'react';
import type { Job } from '../types';
import { createDefaultUnit } from '../lib/calculator';
import { loadPresets, unitFromPreset } from '../lib/presets';
import { ClientForm } from './ClientForm';
import { MaterialsForm } from './MaterialsForm';
import { PresetPicker, UnitForm } from './UnitForm';
import { CutListView } from './CutListView';
import { CollapsibleSection } from './CollapsibleSection';

interface Props {
  job: Job;
  onChange: (job: Job) => void;
  onBack: () => void;
}

type Tab = 'details' | 'cutlist';

export function JobEditor({ job, onChange, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('details');
  const activeUnitCount = job.units.filter((u) => (u.unitQty ?? 0) > 0).length;

  const addUnit = () => {
    onChange({ ...job, units: [...job.units, createDefaultUnit(job, job.units.length)] });
  };

  const addFromPreset = (presetId: string) => {
    const preset = loadPresets().find((p) => p.id === presetId);
    if (!preset) return;
    const unit = unitFromPreset(preset);
    onChange({ ...job, units: [...job.units, unit] });
  };

  return (
    <div className="job-editor">
      <header className="page-header">
        <div>
          <button type="button" className="btn btn-ghost back-btn" onClick={onBack}>← Jobs</button>
          <h1>{job.client.name || 'Untitled job'}</h1>
          {job.client.ref && <p className="subtitle">Ref: {job.client.ref}</p>}
        </div>
        <div className="tab-bar">
          <button type="button" className={`tab ${tab === 'details' ? 'active' : ''}`} onClick={() => setTab('details')}>
            Job details
          </button>
          <button type="button" className={`tab ${tab === 'cutlist' ? 'active' : ''}`} onClick={() => setTab('cutlist')}>
            Cut list
          </button>
        </div>
      </header>

      {tab === 'details' ? (
        <>
          <ClientForm client={job.client} onChange={(client) => onChange({ ...job, client })} />
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

          <CollapsibleSection
            title={`Units (${activeUnitCount} on cut list · ${job.units.length} configured)`}
            defaultOpen
          >
            <div className="units-toolbar">
              <PresetPicker onSelect={addFromPreset} />
              <button type="button" className="btn btn-primary btn-sm" onClick={addUnit}>+ Add unit</button>
            </div>
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
                onRemove={() => onChange({ ...job, units: job.units.filter((u) => u.id !== unit.id) })}
              />
            ))}
          </CollapsibleSection>
        </>
      ) : (
        <CutListView job={job} />
      )}
    </div>
  );
}

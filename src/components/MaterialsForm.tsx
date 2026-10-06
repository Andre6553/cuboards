import { useState } from 'react';
import {
  CONNECTING_FITTING_CATALOG,
  CUT_SIZE_MODE_LABELS,
  DEFAULT_CONNECTING_FITTING_USAGE,
  DEFAULT_INSTALL_RATES,
  DEFAULT_SCREW_USAGE,
  GELMAR_CONNECTING_FITTINGS_SCRAPED_AT,
  GELMAR_HINGES_SCRAPED_AT,
  GELMAR_SCRAPED_AT,
  GELMAR_SCREWS_SCRAPED_AT,
  getConnectingFittingById,
  getHingeById,
  getHingeGroups,
  getRunnerById,
  getRunnerGroups,
  getScrewById,
  SCREW_CATALOG,
} from '../lib/constants';
import {
  applyGelmarPricesToJob,
  emptyGelmarRefreshUi,
  fetchGelmarLivePrices,
  gelmarRefreshFetchErrorMessage,
  gelmarRefreshNote,
  type GelmarRefreshUiState,
} from '../lib/gelmarPriceRefresh';

import type { ConnectingFittingPrices, CutSizeMode, EdgingMaterial, HingePrices, InstallRates, Job, MasoniteConfig, Material, PlasticKickplateConfig, RunnerPrices, ScrewPrices } from '../types';

import { CollapsibleSection } from './CollapsibleSection';
import { GelmarPriceRefreshPanel } from './GelmarPriceRefreshPanel';



interface Props {

  materials: Material[];

  edgingMaterials: EdgingMaterial[];

  masonite: MasoniteConfig;

  plasticKickplate: PlasticKickplateConfig;

  runnerPrices: RunnerPrices;

  hingePrices: HingePrices;

  screwPrices: ScrewPrices;

  connectingFittingPrices: ConnectingFittingPrices;

  installRates: InstallRates;

  settings: Job['settings'];

  onMaterialsChange: (materials: Material[]) => void;

  onEdgingChange: (edging: EdgingMaterial[]) => void;

  onMasoniteChange: (masonite: MasoniteConfig) => void;

  onPlasticKickplateChange: (plasticKickplate: PlasticKickplateConfig) => void;

  onRunnerPricesChange: (prices: RunnerPrices) => void;

  onHingePricesChange: (prices: HingePrices) => void;

  onScrewPricesChange: (prices: ScrewPrices) => void;

  onConnectingFittingPricesChange: (prices: ConnectingFittingPrices) => void;

  onInstallRatesChange: (rates: InstallRates) => void;

  onSettingsChange: (settings: Job['settings']) => void;

}



export function MaterialsForm({

  materials,

  edgingMaterials,

  masonite,

  plasticKickplate,

  runnerPrices,

  hingePrices,

  screwPrices,

  connectingFittingPrices,

  installRates,

  settings,

  onMaterialsChange,

  onEdgingChange,

  onMasoniteChange,

  onPlasticKickplateChange,

  onRunnerPricesChange,

  onHingePricesChange,

  onScrewPricesChange,

  onConnectingFittingPricesChange,

  onInstallRatesChange,

  onSettingsChange,

}: Props) {

  const install = { ...DEFAULT_INSTALL_RATES, ...installRates };

  const patchInstall = (patch: Partial<InstallRates>) => onInstallRatesChange({ ...install, ...patch });

  const [refreshingRunners, setRefreshingRunners] = useState(false);
  const [runnerRefresh, setRunnerRefresh] = useState<GelmarRefreshUiState>(() => emptyGelmarRefreshUi());
  const [refreshingHinges, setRefreshingHinges] = useState(false);
  const [hingeRefresh, setHingeRefresh] = useState<GelmarRefreshUiState>(() => emptyGelmarRefreshUi());
  const [refreshingScrews, setRefreshingScrews] = useState(false);
  const [screwRefresh, setScrewRefresh] = useState<GelmarRefreshUiState>(() => emptyGelmarRefreshUi());
  const [refreshingFittings, setRefreshingFittings] = useState(false);
  const [fittingRefresh, setFittingRefresh] = useState<GelmarRefreshUiState>(() => emptyGelmarRefreshUi());

  const formatRunnerChangeLabel = (id: string) => {
    const r = getRunnerById(id);
    if (!r) return id;
    const category = (r.categoryLabel ?? r.category).replace(/^Gelmar — /, '');
    const parts = [category, r.sku ? `SKU ${r.sku}` : null, r.lengthMm ? `${r.lengthMm} mm` : null].filter(Boolean);
    return parts.join(' · ');
  };

  const formatHingeChangeLabel = (id: string) => {
    const h = getHingeById(id);
    if (!h) return id;
    const category = h.categoryLabel.replace(/^Gelmar — /, '');
    return [category, h.sku ? `SKU ${h.sku}` : null, h.shortName.replace(/ · SKU \d+ · R [\d.]+$/, '')].filter(Boolean).join(' · ');
  };

  const formatScrewChangeLabel = (id: string) => {
    const s = getScrewById(id);
    if (!s) return id;
    return `SKU ${s.sku} · ${s.diameterMm}×${s.lengthMm} mm · pack ${s.packSize}`;
  };

  const formatFittingChangeLabel = (id: string) => {
    const f = getConnectingFittingById(id);
    if (!f) return id;
    return `SKU ${f.sku} · pack ${f.packSize}`;
  };

  const runGelmarRefresh = async (options: {
    apiPath: string;
    setRefreshing: (v: boolean) => void;
    setUi: (ui: GelmarRefreshUiState) => void;
    currentPrices: Record<string, number>;
    getDefault: (id: string) => number | undefined;
    formatLabel: (id: string) => string;
    onPricesChange: (next: Record<string, number>) => void;
  }) => {
    options.setRefreshing(true);
    options.setUi(emptyGelmarRefreshUi());
    try {
      const data = await fetchGelmarLivePrices(options.apiPath);
      const { nextPrices, changes, checked } = applyGelmarPricesToJob(
        options.currentPrices,
        data.prices,
        options.getDefault,
        options.formatLabel,
      );
      options.onPricesChange(nextPrices);
      options.setUi({
        note: gelmarRefreshNote(changes, checked.length, data.scrapedAt),
        error: null,
        changes,
        checked,
        liveAt: data.scrapedAt ?? null,
      });
    } catch (err) {
      options.setUi({
        ...emptyGelmarRefreshUi(),
        error: gelmarRefreshFetchErrorMessage(err),
      });
    } finally {
      options.setRefreshing(false);
    }
  };

  const refreshGelmarRunners = () =>
    void runGelmarRefresh({
      apiPath: '/api/gelmar-runners',
      setRefreshing: setRefreshingRunners,
      setUi: setRunnerRefresh,
      currentPrices: runnerPrices,
      getDefault: (id) => getRunnerById(id)?.defaultPrice,
      formatLabel: formatRunnerChangeLabel,
      onPricesChange: onRunnerPricesChange,
    });

  const refreshGelmarHinges = () =>
    void runGelmarRefresh({
      apiPath: '/api/gelmar-hinges',
      setRefreshing: setRefreshingHinges,
      setUi: setHingeRefresh,
      currentPrices: hingePrices,
      getDefault: (id) => getHingeById(id)?.defaultPrice,
      formatLabel: formatHingeChangeLabel,
      onPricesChange: onHingePricesChange,
    });

  const refreshGelmarScrews = () =>
    void runGelmarRefresh({
      apiPath: '/api/gelmar-screws',
      setRefreshing: setRefreshingScrews,
      setUi: setScrewRefresh,
      currentPrices: screwPrices,
      getDefault: (id) => getScrewById(id)?.defaultPackPrice,
      formatLabel: formatScrewChangeLabel,
      onPricesChange: onScrewPricesChange,
    });

  const refreshGelmarFittings = () =>
    void runGelmarRefresh({
      apiPath: '/api/gelmar-connecting-fittings',
      setRefreshing: setRefreshingFittings,
      setUi: setFittingRefresh,
      currentPrices: connectingFittingPrices,
      getDefault: (id) => getConnectingFittingById(id)?.defaultPackPrice,
      formatLabel: formatFittingChangeLabel,
      onPricesChange: onConnectingFittingPricesChange,
    });

  const updateMaterial = (id: string, field: keyof Material, value: string | number | boolean) => {

    onMaterialsChange(materials.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

  };



  const addMaterial = () => {

    onMaterialsChange([

      ...materials,

      {

        id: crypto.randomUUID(),

        name: 'New material',

        colour: '',

        pricePerSheet: 0,

        hasGrain: false,

        edgingMaterialId: edgingMaterials[0]?.id ?? '',

      },

    ]);

  };



  const updateEdging = (id: string, field: keyof EdgingMaterial, value: string | number) => {

    onEdgingChange(edgingMaterials.map((e) => (e.id === id ? { ...e, [field]: value } : e)));

  };



  const addEdging = () => {

    onEdgingChange([

      ...edgingMaterials,

      { id: crypto.randomUUID(), name: 'New edging', thickness: 1, pricePerMetre: 10 },

    ]);

  };



  return (

    <>

      <CollapsibleSection title="Job settings">

        <div className="form-grid form-grid-4">

          <label>

            Door/drawer gap (mm)

            <input type="number" value={settings.defaultGap} onChange={(e) => onSettingsChange({ ...settings, defaultGap: Number(e.target.value) })} />

          </label>

          <label>

            Default filler width (mm)

            <input type="number" value={settings.defaultFillerWidth} onChange={(e) => onSettingsChange({ ...settings, defaultFillerWidth: Number(e.target.value) })} />

          </label>

          <label>

            Default kickplate height (mm)

            <input type="number" value={settings.defaultKickplateHeight} onChange={(e) => onSettingsChange({ ...settings, defaultKickplateHeight: Number(e.target.value) })} />

          </label>

          <label>

            Feet per kitchen base

            <input type="number" min={2} max={8} value={settings.feetPerBaseUnit} onChange={(e) => onSettingsChange({ ...settings, feetPerBaseUnit: Number(e.target.value) })} />

          </label>

          <label>

            Plastic foot price (R each)

            <input type="number" value={settings.pricePerFoot} onChange={(e) => onSettingsChange({ ...settings, pricePerFoot: Number(e.target.value) })} />

          </label>

          <label>

            Cut list sizes

            <select

              value={settings.cutSizeMode ?? 'final'}

              onChange={(e) => onSettingsChange({ ...settings, cutSizeMode: e.target.value as CutSizeMode })}

            >

              {Object.entries(CUT_SIZE_MODE_LABELS).map(([k, v]) => (

                <option key={k} value={k}>{v}</option>

              ))}

            </select>

          </label>

        </div>

        <p className="hint">

          {(settings.cutSizeMode ?? 'final') === 'net'

            ? 'Net cut mode: board dimensions in the cut list have edging tape thickness subtracted on each edged side (uses thickness from edging tape linked to each board).'

            : 'Final size mode: cut list dimensions include edging — use as finished panel sizes after edge banding.'}

        </p>

      </CollapsibleSection>



      <CollapsibleSection title="Sheet Size setting">

        <div className="sheet-settings-row">

          <label>

            Board thickness (mm)

            <select

              value={settings.thickness}

              onChange={(e) => onSettingsChange({ ...settings, thickness: Number(e.target.value) as 16 | 18 })}

            >

              <option value={16}>16 mm</option>

              <option value={18}>18 mm</option>

            </select>

          </label>

          <label className="sheet-size-field">

            Melamine sheet size (mm)

            <div className="sheet-size-pair">

              <input

                type="number"

                min={100}

                value={settings.sheetWidth}

                title="Sheet length"

                onChange={(e) => onSettingsChange({ ...settings, sheetWidth: Math.max(100, Number(e.target.value) || 2750) })}

              />

              <span className="sheet-size-sep">×</span>

              <input

                type="number"

                min={100}

                value={settings.sheetHeight}

                title="Sheet width"

                onChange={(e) => onSettingsChange({ ...settings, sheetHeight: Math.max(100, Number(e.target.value) || 1830) })}

              />

            </div>

          </label>

        </div>

        <p className="hint">

          Board thickness applies to all carcass parts. Sheet size {settings.sheetWidth} × {settings.sheetHeight} mm is used for costing — estimated usage is rounded up in ¼-sheet steps (default sheet 2750 × 1830). For boards with <strong>Grain</strong> ticked, sheets are counted from a layout: grain runs along the sheet's long side, and sides, doors and drawer fronts are never rotated (grain top to bottom).

        </p>

      </CollapsibleSection>



      <CollapsibleSection title="Board materials — price per sheet">

        <p className="hint">Set your melamine board prices here. Link each board to its edging tape below.</p>

        <div className="table-wrap">

          <table className="data-table">

            <thead>

              <tr>

                <th>Material</th>

                <th>Colour</th>

                <th>Price / sheet (R)</th>

                <th>Grain</th>

                <th>Edging tape</th>

                <th></th>

              </tr>

            </thead>

            <tbody>

              {materials.map((m) => (

                <tr key={m.id}>

                  <td><input className="table-input" value={m.name} onChange={(e) => updateMaterial(m.id, 'name', e.target.value)} /></td>

                  <td><input className="table-input" value={m.colour} onChange={(e) => updateMaterial(m.id, 'colour', e.target.value)} /></td>

                  <td><input className="table-input" type="number" value={m.pricePerSheet} onChange={(e) => updateMaterial(m.id, 'pricePerSheet', Number(e.target.value))} /></td>

                  <td className="center"><input type="checkbox" checked={m.hasGrain} onChange={(e) => updateMaterial(m.id, 'hasGrain', e.target.checked)} /></td>

                  <td>

                    <select value={m.edgingMaterialId} onChange={(e) => updateMaterial(m.id, 'edgingMaterialId', e.target.value)}>

                      {edgingMaterials.map((e) => (

                        <option key={e.id} value={e.id}>{e.name} ({e.thickness}mm)</option>

                      ))}

                    </select>

                  </td>

                  <td>

                    {materials.length > 1 && (

                      <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => onMaterialsChange(materials.filter((x) => x.id !== m.id))}>Remove</button>

                    )}

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

        <button type="button" className="btn btn-secondary btn-sm" onClick={addMaterial}>+ Add board material</button>

      </CollapsibleSection>



      <CollapsibleSection title="Edging tape — price per metre">

        <p className="hint">Thickness is used on the cut list (e.g. 1mm PVC, 2mm ABS).</p>

        <div className="table-wrap">

          <table className="data-table">

            <thead>

              <tr>

                <th>Edging name</th>

                <th>Thickness (mm)</th>

                <th>Price / metre (R)</th>

                <th></th>

              </tr>

            </thead>

            <tbody>

              {edgingMaterials.map((e) => (

                <tr key={e.id}>

                  <td><input className="table-input" value={e.name} onChange={(ev) => updateEdging(e.id, 'name', ev.target.value)} /></td>

                  <td><input className="table-input" type="number" step="0.1" value={e.thickness} onChange={(ev) => updateEdging(e.id, 'thickness', Number(ev.target.value))} /></td>

                  <td><input className="table-input" type="number" value={e.pricePerMetre} onChange={(ev) => updateEdging(e.id, 'pricePerMetre', Number(ev.target.value))} /></td>

                  <td>

                    {edgingMaterials.length > 1 && (

                      <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => onEdgingChange(edgingMaterials.filter((x) => x.id !== e.id))}>Remove</button>

                    )}

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

        <button type="button" className="btn btn-secondary btn-sm" onClick={addEdging}>+ Add edging tape</button>

      </CollapsibleSection>



      <CollapsibleSection title="Masonite backing">

        <p className="hint">Used for drawer bottoms and carcass backs when masonite is selected.</p>

        <div className="form-grid form-grid-4">

          <label>Name<input value={masonite.name} onChange={(e) => onMasoniteChange({ ...masonite, name: e.target.value })} /></label>

          <label>Colour<input value={masonite.colour} onChange={(e) => onMasoniteChange({ ...masonite, colour: e.target.value })} placeholder="e.g. Brown, White" /></label>

          <label>Thickness (mm)<input type="number" value={masonite.thickness} onChange={(e) => onMasoniteChange({ ...masonite, thickness: Number(e.target.value) })} /></label>

          <label>Price / sheet (R)<input type="number" value={masonite.pricePerSheet} onChange={(e) => onMasoniteChange({ ...masonite, pricePerSheet: Number(e.target.value) })} /></label>

        </div>

        <p className="hint">Masonite sheet: {masonite.sheetWidth} × {masonite.sheetHeight} mm</p>

      </CollapsibleSection>



      <CollapsibleSection title="Plastic kickplate strip">

        <p className="hint">Used when a unit has plastic kickplate. Price is per linear metre; set strip height and width to match your supplier profile.</p>

        <div className="form-grid form-grid-4">

          <label>Name<input value={plasticKickplate.name} onChange={(e) => onPlasticKickplateChange({ ...plasticKickplate, name: e.target.value })} /></label>

          <label>Strip height (mm)<input type="number" value={plasticKickplate.stripHeight} onChange={(e) => onPlasticKickplateChange({ ...plasticKickplate, stripHeight: Number(e.target.value) })} /></label>

          <label>Strip width (mm)<input type="number" value={plasticKickplate.stripWidth} onChange={(e) => onPlasticKickplateChange({ ...plasticKickplate, stripWidth: Number(e.target.value) })} /></label>

          <label>Price / metre (R)<input type="number" value={plasticKickplate.pricePerMetre} onChange={(e) => onPlasticKickplateChange({ ...plasticKickplate, pricePerMetre: Number(e.target.value) })} /></label>

        </div>

      </CollapsibleSection>



      <CollapsibleSection title="Drawer runner prices — price per pair">

        <GelmarPriceRefreshPanel
          snapshotScrapedAt={GELMAR_SCRAPED_AT}
          liveAt={runnerRefresh.liveAt}
          refreshing={refreshingRunners}
          onRefresh={refreshGelmarRunners}
          note={runnerRefresh.note}
          error={runnerRefresh.error}
          changes={runnerRefresh.changes}
          checked={runnerRefresh.checked}
          hint="Gelmar pair prices. Refresh pulls current prices from gelmar.co.za into this job. Override any price for your supplier."
        />

        <div className="table-wrap gelmar-prices">

          <table className="data-table data-table-compact">

            <thead>

              <tr>

                <th>Category</th>

                <th>SKU</th>

                <th>Length</th>

                <th>R / pair</th>

              </tr>

            </thead>

            <tbody>

              {getRunnerGroups()

                .filter((g) => g.category !== 'brand')

                .flatMap((g) =>

                  g.runners.map((r) => (

                    <tr key={r.id}>

                      <td>{g.label.replace('Gelmar — ', '')}</td>

                      <td>{r.sku ?? '—'}</td>

                      <td>{r.lengthMm ? `${r.lengthMm} mm` : '—'}</td>

                      <td>

                        <input

                          type="number"

                          className="price-input-inline"

                          value={runnerPrices[r.id] ?? r.defaultPrice}

                          onChange={(e) => onRunnerPricesChange({ ...runnerPrices, [r.id]: Number(e.target.value) })}

                        />

                      </td>

                    </tr>

                  )),

                )}

            </tbody>

          </table>

        </div>

      </CollapsibleSection>



      <CollapsibleSection title="Cabinet hinge prices — price each">

        <GelmarPriceRefreshPanel
          snapshotScrapedAt={GELMAR_HINGES_SCRAPED_AT}
          liveAt={hingeRefresh.liveAt}
          refreshing={refreshingHinges}
          onRefresh={refreshGelmarHinges}
          note={hingeRefresh.note}
          error={hingeRefresh.error}
          changes={hingeRefresh.changes}
          checked={hingeRefresh.checked}
          hint={
            <>
              Gelmar hinges from{' '}
              <a href="https://www.gelmar.co.za/hinges/gelmar-slide-on-4-hole.html" target="_blank" rel="noreferrer">
                slide-on
              </a>{' '}
              &amp;{' '}
              <a href="https://www.gelmar.co.za/hinges.html?cat=34_gelmar-soft-close-clip" target="_blank" rel="noreferrer">
                soft close
              </a>
              . Refresh updates price each from gelmar.co.za. Override for your branch.
            </>
          }
        />

        <div className="table-wrap gelmar-prices">

          <table className="data-table data-table-compact">

            <thead>

              <tr>

                <th>Category</th>

                <th>SKU</th>

                <th>Spec</th>

                <th>R / each</th>

              </tr>

            </thead>

            <tbody>

              {getHingeGroups().flatMap((g) =>

                g.hinges.map((h) => (

                  <tr key={h.id}>

                    <td>{g.label.replace('Gelmar — ', '')}</td>

                    <td>{h.sku ?? '—'}</td>

                    <td>{h.shortName.replace(/ · SKU \d+ · R [\d.]+$/, '')}</td>

                    <td>

                      <input

                        type="number"

                        className="price-input-inline"

                        step={0.01}

                        value={hingePrices[h.id] ?? h.defaultPrice}

                        onChange={(e) => onHingePricesChange({ ...hingePrices, [h.id]: Number(e.target.value) })}

                      />

                    </td>

                  </tr>

                )),

              )}

            </tbody>

          </table>

        </div>

      </CollapsibleSection>



      <CollapsibleSection title="Screw packs — Gelmar (price per pack)">

        <GelmarPriceRefreshPanel
          snapshotScrapedAt={GELMAR_SCREWS_SCRAPED_AT}
          liveAt={screwRefresh.liveAt}
          refreshing={refreshingScrews}
          onRefresh={refreshGelmarScrews}
          note={screwRefresh.note}
          error={screwRefresh.error}
          changes={screwRefresh.changes}
          checked={screwRefresh.checked}
          hint="Gelmar screw pack prices. Refresh pulls pack prices from each product page on gelmar.co.za."
        />

        <p className="hint">
          Usage: chipboard {DEFAULT_SCREW_USAGE.chipboardPerCupboard}/cupboard · drywall 3.5×28 mm {DEFAULT_SCREW_USAGE.drywall28PerDrawerFront}/drawer front ·
          3.5×32 mm {DEFAULT_SCREW_USAGE.drywall32PerCupboard}/cupboard · 6×32 mm {DEFAULT_SCREW_USAGE.drywall6PerCupboard}/cupboard + {DEFAULT_SCREW_USAGE.drywall6PerDrawer}/drawer.
          Packs rounded up on cost estimate.
        </p>

        <div className="table-wrap gelmar-prices">

          <table className="data-table data-table-compact">

            <thead>

              <tr>

                <th>SKU</th>

                <th>Spec</th>

                <th>Pack</th>

                <th>R / pack</th>

              </tr>

            </thead>

            <tbody>

              {SCREW_CATALOG.map((s) => (

                <tr key={s.id}>

                  <td>{s.sku}</td>

                  <td>{s.diameterMm}×{s.lengthMm} mm</td>

                  <td>{s.packSize}</td>

                  <td>

                    <input

                      type="number"

                      className="price-input-inline"

                      step={0.01}

                      value={screwPrices[s.id] ?? s.defaultPackPrice}

                      onChange={(e) => onScrewPricesChange({ ...screwPrices, [s.id]: Number(e.target.value) })}

                    />

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </CollapsibleSection>



      <CollapsibleSection title="Connecting fittings — Gelmar (price per pack)">

        <GelmarPriceRefreshPanel
          snapshotScrapedAt={GELMAR_CONNECTING_FITTINGS_SCRAPED_AT}
          liveAt={fittingRefresh.liveAt}
          refreshing={refreshingFittings}
          onRefresh={refreshGelmarFittings}
          note={fittingRefresh.note}
          error={fittingRefresh.error}
          changes={fittingRefresh.changes}
          checked={fittingRefresh.checked}
          hint="Gelmar connecting fitting pack prices. Refresh pulls pack prices from gelmar.co.za."
        />

        <p className="hint">
          Corner block with cap: {DEFAULT_CONNECTING_FITTING_USAGE.cornerBlockPerCupboard}/cupboard · packs rounded up on cost estimate.
        </p>

        <div className="table-wrap gelmar-prices">

          <table className="data-table data-table-compact">

            <thead>

              <tr>

                <th>SKU</th>

                <th>Item</th>

                <th>Pack</th>

                <th>R / pack</th>

              </tr>

            </thead>

            <tbody>

              {CONNECTING_FITTING_CATALOG.map((f) => (

                <tr key={f.id}>

                  <td>{f.sku}</td>

                  <td>{f.lengthMm}×{f.widthMm}×{f.heightMm} mm corner block</td>

                  <td>{f.packSize}</td>

                  <td>

                    <input

                      type="number"

                      className="price-input-inline"

                      step={0.01}

                      value={connectingFittingPrices[f.id] ?? f.defaultPackPrice}

                      onChange={(e) => onConnectingFittingPricesChange({ ...connectingFittingPrices, [f.id]: Number(e.target.value) })}

                    />

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </CollapsibleSection>



      <CollapsibleSection title="Installation labour — rates">

        <p className="hint">
          Per cupboard by unit type + per door leaf + per drawer + wall-mount premium. Minimum job and travel added on the cut list. Supply (boards/hardware) is separate.
        </p>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={install.enabled}
            onChange={(e) => patchInstall({ enabled: e.target.checked })}
          />
          Include installation on cut list &amp; quote
        </label>

        <div className="form-grid form-grid-3 sheet-settings-row">

          <label>
            Kitchen base / cupboard (R)
            <input type="number" min={0} value={install.kitchenBasePerCupboard} onChange={(e) => patchInstall({ kitchenBasePerCupboard: Number(e.target.value) })} />
          </label>

          <label>
            Wall unit / cupboard (R)
            <input type="number" min={0} value={install.wallUnitPerCupboard} onChange={(e) => patchInstall({ wallUnitPerCupboard: Number(e.target.value) })} />
          </label>

          <label>
            Bedroom / cupboard (R)
            <input type="number" min={0} value={install.bedroomPerCupboard} onChange={(e) => patchInstall({ bedroomPerCupboard: Number(e.target.value) })} />
          </label>

          <label>
            Per door leaf (R)
            <input type="number" min={0} value={install.perDoorLeaf} onChange={(e) => patchInstall({ perDoorLeaf: Number(e.target.value) })} />
          </label>

          <label>
            Per drawer (R)
            <input type="number" min={0} value={install.perDrawer} onChange={(e) => patchInstall({ perDrawer: Number(e.target.value) })} />
          </label>

          <label>
            Wall-mount premium / cupboard (R)
            <input type="number" min={0} value={install.wallMountPremium} onChange={(e) => patchInstall({ wallMountPremium: Number(e.target.value) })} title="Added when unit mount type is wall" />
          </label>

          <label>
            Minimum job (R)
            <input type="number" min={0} value={install.minimumJob} onChange={(e) => patchInstall({ minimumJob: Number(e.target.value) })} />
          </label>

          <label>
            Travel fee (R)
            <input type="number" min={0} value={install.travelFee} onChange={(e) => patchInstall({ travelFee: Number(e.target.value) })} />
          </label>

        </div>

      </CollapsibleSection>

    </>

  );

}



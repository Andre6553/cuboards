import { useState } from 'react';
import {
  CONNECTING_FITTING_CATALOG,
  CUT_SIZE_MODE_LABELS,
  DEFAULT_CONNECTING_FITTING_USAGE,
  DEFAULT_INSTALL_RATES,
  DEFAULT_QUOTE_TERMS,
  DEFAULT_SCREW_USAGE,
  SHEET_SIZE_PRESETS,
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
  gelmarRefreshNote,
  notifyGelmarRefreshFailure,
  type GelmarRefreshUiState,
} from '../lib/gelmarPriceRefresh';
import {
  formatMoney,
  priceInputLabel,
  QUOTE_CURRENCIES,
  ratePerUnitLabel,
  resolveQuoteCurrency,
} from '../lib/currency';

import type {
  ConnectingFittingPrices,
  CutSizeMode,
  CustomHardwareItem,
  EdgingMaterial,
  HardwarePricing,
  HingePrices,
  InstallRates,
  Job,
  MasoniteConfig,
  Material,
  PlasticKickplateConfig,
  QuoteTerms,
  RunnerPrices,
  ScrewPrices,
} from '../types';

import { CollapsibleSection } from './CollapsibleSection';
import { CustomHardwareEditor } from './CustomHardwareEditor';
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

  quoteTerms: QuoteTerms;

  hardwarePricing: HardwarePricing;

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

  onQuoteTermsChange: (terms: QuoteTerms) => void;

  onHardwarePricingChange: (pricing: HardwarePricing) => void;

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

  quoteTerms,

  onQuoteTermsChange,

  hardwarePricing,

  onHardwarePricingChange,

}: Props) {

  type CustomCat = keyof HardwarePricing['customCatalog'];

  const setUseGelmar = (category: keyof HardwarePricing['useGelmarCatalog'], useGelmar: boolean) =>
    onHardwarePricingChange({
      ...hardwarePricing,
      useGelmarCatalog: { ...hardwarePricing.useGelmarCatalog, [category]: useGelmar },
    });

  const setCustomCatalog = (category: CustomCat, items: CustomHardwareItem[]) =>
    onHardwarePricingChange({
      ...hardwarePricing,
      customCatalog: { ...hardwarePricing.customCatalog, [category]: items },
    });

  const install = { ...DEFAULT_INSTALL_RATES, ...installRates };
  const terms = { ...DEFAULT_QUOTE_TERMS, ...quoteTerms };
  const patchTerms = (patch: Partial<QuoteTerms>) => onQuoteTermsChange({ ...terms, ...patch });
  const fmt = (n: number) => formatMoney(n, settings);
  const currencySymbol = resolveQuoteCurrency(settings).symbol;

  const sheetPresetKey =
    SHEET_SIZE_PRESETS.find(
      (p) => p.width > 0 && p.width === settings.sheetWidth && p.height === settings.sheetHeight,
    )?.label ?? 'Custom';

  const applySheetPreset = (label: string) => {
    const preset = SHEET_SIZE_PRESETS.find((p) => p.label === label);
    if (!preset || preset.width === 0) return;
    onSettingsChange({ ...settings, sheetWidth: preset.width, sheetHeight: preset.height });
  };

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
        error: notifyGelmarRefreshFailure(err),
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

  const updateMaterial = (
    id: string,
    field: keyof Material,
    value: string | number | boolean | Material['sheetPurchaseUnit'],
  ) => {

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

        sheetPurchaseUnit: 'quarter',

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

            {priceInputLabel(settings, 'Plastic foot price each')}

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

          <label>
            Quote currency
            <select
              value={settings.quoteCurrency ?? 'ZAR'}
              onChange={(e) => onSettingsChange({ ...settings, quoteCurrency: e.target.value })}
            >
              {QUOTE_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            VAT rate (%)
            <input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={settings.vatRatePercent ?? 15}
              onChange={(e) => onSettingsChange({ ...settings, vatRatePercent: Number(e.target.value) })}
            />
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.pricesEnterAsInclVat === true}
              onChange={(e) => onSettingsChange({ ...settings, pricesEnterAsInclVat: e.target.checked })}
            />
            My prices are entered <strong>including VAT</strong>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.showVatOnQuote !== false}
              onChange={(e) => onSettingsChange({ ...settings, showVatOnQuote: e.target.checked })}
            />
            Show VAT breakdown on quotes
          </label>

        </div>

        <p className="hint">
          {settings.pricesEnterAsInclVat ? (
            <>
              Board, edging, hardware, and install rates are treated as <strong>incl VAT</strong>.
              {settings.showVatOnQuote !== false
                ? ' Client quote and PDF show ex VAT + VAT + total incl VAT (VAT is not added twice).'
                : ' Quotes show the incl VAT total from your prices.'}
            </>
          ) : (
            <>
              Board, edging, hardware, and install rates are <strong>ex VAT</strong> (default).
              {settings.showVatOnQuote !== false
                ? ` Client quote and PDF add ${settings.vatRatePercent ?? 15}% VAT on top.`
                : ' Quotes show ex VAT totals only.'}
            </>
          )}
        </p>

        <p className="hint">

          {(settings.cutSizeMode ?? 'final') === 'net'

            ? 'Net cut mode: board dimensions in the cut list have edging tape thickness subtracted on each edged side (uses thickness from edging tape linked to each board).'

            : 'Final size mode: cut list dimensions include edging — use as finished panel sizes after edge banding.'}

        </p>

      </CollapsibleSection>



      <CollapsibleSection title="Sheet Size setting">

        <div className="sheet-settings-row">

          <label>
            Sheet size preset
            <select
              value={sheetPresetKey}
              onChange={(e) => {
                if (e.target.value === 'Custom') return;
                applySheetPreset(e.target.value);
              }}
            >
              {SHEET_SIZE_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
            </select>
          </label>

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

          Board thickness applies to all carcass parts (many SA kitchens use <strong>18 mm</strong> on bases, <strong>16 mm</strong> on wall units — pick one thickness per job). Sheet size {settings.sheetWidth} × {settings.sheetHeight} mm is used for costing — estimated usage uses each board&apos;s <strong>Buy as</strong> setting. For boards with <strong>Grain</strong> ticked, sheets are counted from a layout: grain runs along the sheet&apos;s long side, and sides, doors and drawer fronts are never rotated (grain top to bottom).

        </p>

        <label>
          Board cutting allowance (%)
          <input
            type="number"
            min={0}
            max={50}
            step={1}
            value={settings.boardWastagePercent ?? 0}
            onChange={(e) => onSettingsChange({ ...settings, boardWastagePercent: Math.max(0, Number(e.target.value)) })}
          />
        </label>
        <p className="hint">
          Adds extra area before sheet count (e.g. 10% for offcuts and cutting waste). 0 = area estimate only.
        </p>

      </CollapsibleSection>



      <CollapsibleSection title="Board materials — price per sheet">

        <p className="hint">
          Set your melamine board prices here. <strong>Buy as</strong> is the smallest board size your supplier will sell
          for that colour (¼, ½, or full sheet only). Sheet count rounds up to that step so you do not pay for a whole
          extra sheet when you only need a bit more — e.g. need 1.05 sheets and ¼ sheets are available → quote 1.25, not 2.
          Link each board to its edging tape below.
        </p>

        <div className="table-wrap">

          <table className="data-table materials-board-table">

            <thead>

              <tr>

                <th>Material</th>

                <th>Colour</th>

                <th>{priceInputLabel(settings, 'Price / sheet')}</th>

                <th>Grain</th>

                <th title="Smallest size supplier sells">Buy as</th>

                <th>Edging tape</th>

                <th></th>

              </tr>

            </thead>

            <tbody>

              {materials.map((m) => (

                <tr key={m.id}>

                  <td data-label="Material"><input className="table-input" value={m.name} onChange={(e) => updateMaterial(m.id, 'name', e.target.value)} /></td>

                  <td data-label="Colour"><input className="table-input" value={m.colour} onChange={(e) => updateMaterial(m.id, 'colour', e.target.value)} /></td>

                  <td data-label="Price / sheet"><input className="table-input" type="number" value={m.pricePerSheet} onChange={(e) => updateMaterial(m.id, 'pricePerSheet', Number(e.target.value))} /></td>

                  <td className="center" data-label="Grain"><input type="checkbox" checked={m.hasGrain} onChange={(e) => updateMaterial(m.id, 'hasGrain', e.target.checked)} /></td>

                  <td data-label="Buy as">
                    <select
                      className="table-input table-select"
                      value={m.sheetPurchaseUnit ?? 'quarter'}
                      onChange={(e) =>
                        updateMaterial(m.id, 'sheetPurchaseUnit', e.target.value as Material['sheetPurchaseUnit'])
                      }
                    >
                      <option value="quarter">¼ sheet</option>
                      <option value="half">½ sheet</option>
                      <option value="full">Full sheet only</option>
                    </select>
                  </td>

                  <td data-label="Edging tape">

                    <select className="table-input table-select" value={m.edgingMaterialId} onChange={(e) => updateMaterial(m.id, 'edgingMaterialId', e.target.value)}>

                      {edgingMaterials.map((e) => (

                        <option key={e.id} value={e.id}>{e.name} ({e.thickness}mm)</option>

                      ))}

                    </select>

                  </td>

                  <td data-label="">

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

          <table className="data-table materials-price-table">

            <thead>

              <tr>

                <th>Edging name</th>

                <th>Thickness (mm)</th>

                <th>{priceInputLabel(settings, 'Price / metre')}</th>

                <th></th>

              </tr>

            </thead>

            <tbody>

              {edgingMaterials.map((e) => (

                <tr key={e.id}>

                  <td data-label="Edging name"><input className="table-input" value={e.name} onChange={(ev) => updateEdging(e.id, 'name', ev.target.value)} /></td>

                  <td data-label="Thickness"><input className="table-input" type="number" step="0.1" value={e.thickness} onChange={(ev) => updateEdging(e.id, 'thickness', Number(ev.target.value))} /></td>

                  <td data-label="Price / m"><input className="table-input" type="number" value={e.pricePerMetre} onChange={(ev) => updateEdging(e.id, 'pricePerMetre', Number(ev.target.value))} /></td>

                  <td data-label="">

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

          <label>{priceInputLabel(settings, 'Price / sheet')}<input type="number" value={masonite.pricePerSheet} onChange={(e) => onMasoniteChange({ ...masonite, pricePerSheet: Number(e.target.value) })} /></label>

        </div>

        <label className="sheet-size-field">
          Masonite sheet size (mm)
          <div className="sheet-size-pair">
            <input
              type="number"
              min={100}
              value={masonite.sheetWidth ?? 2440}
              title="Sheet length"
              onChange={(e) =>
                onMasoniteChange({ ...masonite, sheetWidth: Math.max(100, Number(e.target.value) || 2440) })
              }
            />
            <span className="sheet-size-sep">×</span>
            <input
              type="number"
              min={100}
              value={masonite.sheetHeight ?? 1220}
              title="Sheet width"
              onChange={(e) =>
                onMasoniteChange({ ...masonite, sheetHeight: Math.max(100, Number(e.target.value) || 1220) })
              }
            />
          </div>
        </label>

        <p className="hint">
          Sheet size is used for masonite costing on the cut list (area ÷ this size, rounded up in ¼-sheet steps).
          Default 2440 × 1220 mm — change to match your supplier.
        </p>

      </CollapsibleSection>



      <CollapsibleSection title="Plastic kickplate strip">

        <p className="hint">Used when a unit has plastic kickplate. Price is per linear metre; set strip height and width to match your supplier profile.</p>

        <div className="form-grid form-grid-4">

          <label>Name<input value={plasticKickplate.name} onChange={(e) => onPlasticKickplateChange({ ...plasticKickplate, name: e.target.value })} /></label>

          <label>Strip height (mm)<input type="number" value={plasticKickplate.stripHeight} onChange={(e) => onPlasticKickplateChange({ ...plasticKickplate, stripHeight: Number(e.target.value) })} /></label>

          <label>Strip width (mm)<input type="number" value={plasticKickplate.stripWidth} onChange={(e) => onPlasticKickplateChange({ ...plasticKickplate, stripWidth: Number(e.target.value) })} /></label>

          <label>{priceInputLabel(settings, 'Price / metre')}<input type="number" value={plasticKickplate.pricePerMetre} onChange={(e) => onPlasticKickplateChange({ ...plasticKickplate, pricePerMetre: Number(e.target.value) })} /></label>

        </div>

      </CollapsibleSection>



      <CollapsibleSection title="Drawer runner prices — price per pair">

        <CustomHardwareEditor
          category="runners"
          categoryLabel="drawer runners"
          useGelmar={hardwarePricing.useGelmarCatalog.runners}
          onUseGelmarChange={(v) => setUseGelmar('runners', v)}
          items={hardwarePricing.customCatalog.runners}
          onItemsChange={(items) => setCustomCatalog('runners', items)}
          defaultPriceUnit="pair"
          currencySymbol={currencySymbol}
          gelmarPanel={
            <>
              <GelmarPriceRefreshPanel
                snapshotScrapedAt={GELMAR_SCRAPED_AT}
                liveAt={runnerRefresh.liveAt}
                refreshing={refreshingRunners}
                onRefresh={refreshGelmarRunners}
                note={runnerRefresh.note}
                error={runnerRefresh.error}
                changes={runnerRefresh.changes}
                checked={runnerRefresh.checked}
                formatPrice={fmt}
                hint="Gelmar pair prices. Refresh pulls current prices from gelmar.co.za into this job. Override any price for your supplier."
              />

              <p className="hint">
                <strong>Blum / Hettich</strong> rows below use fixed default prices — update manually or use Gelmar refresh above for local trade pricing.
              </p>

              <div className="table-wrap gelmar-prices">
                <table className="data-table data-table-compact">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>SKU</th>
                      <th>Length</th>
                      <th>{ratePerUnitLabel(settings, 'pair')}</th>
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
            </>
          }
        />

      </CollapsibleSection>



      <CollapsibleSection title="Cabinet hinge prices — price each">

        <CustomHardwareEditor
          category="hinges"
          categoryLabel="cabinet hinges"
          useGelmar={hardwarePricing.useGelmarCatalog.hinges}
          onUseGelmarChange={(v) => setUseGelmar('hinges', v)}
          items={hardwarePricing.customCatalog.hinges}
          onItemsChange={(items) => setCustomCatalog('hinges', items)}
          defaultPriceUnit="each"
          currencySymbol={currencySymbol}
          gelmarPanel={
            <>
              <GelmarPriceRefreshPanel
                snapshotScrapedAt={GELMAR_HINGES_SCRAPED_AT}
                liveAt={hingeRefresh.liveAt}
                refreshing={refreshingHinges}
                onRefresh={refreshGelmarHinges}
                note={hingeRefresh.note}
                error={hingeRefresh.error}
                changes={hingeRefresh.changes}
                checked={hingeRefresh.checked}
                formatPrice={fmt}
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
                      <th>{ratePerUnitLabel(settings, 'each')}</th>
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
            </>
          }
        />

      </CollapsibleSection>



      <CollapsibleSection title="Screw packs — Gelmar (price per pack)">

        <CustomHardwareEditor
          category="screws"
          categoryLabel="screw packs"
          useGelmar={hardwarePricing.useGelmarCatalog.screws}
          onUseGelmarChange={(v) => setUseGelmar('screws', v)}
          items={hardwarePricing.customCatalog.screws}
          onItemsChange={(items) => setCustomCatalog('screws', items)}
          packMode
          currencySymbol={currencySymbol}
          gelmarPanel={
            <>
              <GelmarPriceRefreshPanel
                snapshotScrapedAt={GELMAR_SCREWS_SCRAPED_AT}
                liveAt={screwRefresh.liveAt}
                refreshing={refreshingScrews}
                onRefresh={refreshGelmarScrews}
                note={screwRefresh.note}
                error={screwRefresh.error}
                changes={screwRefresh.changes}
                checked={screwRefresh.checked}
                formatPrice={fmt}
                hint="Gelmar screw pack prices. Refresh pulls pack prices from each product page on gelmar.co.za."
              />

              <p className="hint">
                Usage: chipboard {DEFAULT_SCREW_USAGE.chipboardPerCupboard}/cupboard · drywall 3.5×28 mm{' '}
                {DEFAULT_SCREW_USAGE.drywall28PerDrawerFront}/drawer front · 3.5×32 mm {DEFAULT_SCREW_USAGE.drywall32PerCupboard}/cupboard · 6×32 mm{' '}
                {DEFAULT_SCREW_USAGE.drywall6PerCupboard}/cupboard + {DEFAULT_SCREW_USAGE.drywall6PerDrawer}/drawer. Packs rounded up on cost estimate.
              </p>

              <div className="table-wrap gelmar-prices">
                <table className="data-table data-table-compact">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Spec</th>
                      <th>Pack</th>
                      <th>{ratePerUnitLabel(settings, 'pack')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCREW_CATALOG.map((s) => (
                      <tr key={s.id}>
                        <td>{s.sku}</td>
                        <td>
                          {s.diameterMm}×{s.lengthMm} mm
                        </td>
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
            </>
          }
        />

      </CollapsibleSection>



      <CollapsibleSection title="Connecting fittings — Gelmar (price per pack)">

        <CustomHardwareEditor
          category="connectingFittings"
          categoryLabel="connecting fittings"
          useGelmar={hardwarePricing.useGelmarCatalog.connectingFittings}
          onUseGelmarChange={(v) => setUseGelmar('connectingFittings', v)}
          items={hardwarePricing.customCatalog.connectingFittings}
          onItemsChange={(items) => setCustomCatalog('connectingFittings', items)}
          packMode
          currencySymbol={currencySymbol}
          gelmarPanel={
            <>
              <GelmarPriceRefreshPanel
                snapshotScrapedAt={GELMAR_CONNECTING_FITTINGS_SCRAPED_AT}
                liveAt={fittingRefresh.liveAt}
                refreshing={refreshingFittings}
                onRefresh={refreshGelmarFittings}
                note={fittingRefresh.note}
                error={fittingRefresh.error}
                changes={fittingRefresh.changes}
                checked={fittingRefresh.checked}
                formatPrice={fmt}
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
                      <th>{ratePerUnitLabel(settings, 'pack')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CONNECTING_FITTING_CATALOG.map((f) => (
                      <tr key={f.id}>
                        <td>{f.sku}</td>
                        <td>
                          {f.lengthMm}×{f.widthMm}×{f.heightMm} mm corner block
                        </td>
                        <td>{f.packSize}</td>
                        <td>
                          <input
                            type="number"
                            className="price-input-inline"
                            step={0.01}
                            value={connectingFittingPrices[f.id] ?? f.defaultPackPrice}
                            onChange={(e) =>
                              onConnectingFittingPricesChange({ ...connectingFittingPrices, [f.id]: Number(e.target.value) })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          }
        />

      </CollapsibleSection>



      <CollapsibleSection title="Client quote — terms &amp; validity">

        <p className="hint">Used on the Client quote PDF (Cut list → Client quote). Panel sizes are never included.</p>

        <div className="form-grid form-grid-3">

          <label>
            Valid for (days)
            <input type="number" min={1} max={365} value={terms.validityDays} onChange={(e) => patchTerms({ validityDays: Number(e.target.value) })} />
          </label>

          <label>
            Deposit (%)
            <input type="number" min={0} max={100} value={terms.depositPercent} onChange={(e) => patchTerms({ depositPercent: Number(e.target.value) })} />
          </label>

          <label className="span-2">
            Payment terms
            <input value={terms.paymentNote} onChange={(e) => patchTerms({ paymentNote: e.target.value })} placeholder="e.g. Balance on completion via EFT." />
          </label>

          <label className="span-2">
            Extra terms (optional)
            <textarea rows={2} value={terms.extraNotes} onChange={(e) => patchTerms({ extraNotes: e.target.value })} placeholder="Warranty, lead time, access to site…" />
          </label>

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
            {priceInputLabel(settings, 'Kitchen base / cupboard')}
            <input type="number" min={0} value={install.kitchenBasePerCupboard} onChange={(e) => patchInstall({ kitchenBasePerCupboard: Number(e.target.value) })} />
          </label>

          <label>
            {priceInputLabel(settings, 'Wall unit / cupboard')}
            <input type="number" min={0} value={install.wallUnitPerCupboard} onChange={(e) => patchInstall({ wallUnitPerCupboard: Number(e.target.value) })} />
          </label>

          <label>
            {priceInputLabel(settings, 'Bedroom / cupboard')}
            <input type="number" min={0} value={install.bedroomPerCupboard} onChange={(e) => patchInstall({ bedroomPerCupboard: Number(e.target.value) })} />
          </label>

          <label>
            {priceInputLabel(settings, 'Per door leaf')}
            <input type="number" min={0} value={install.perDoorLeaf} onChange={(e) => patchInstall({ perDoorLeaf: Number(e.target.value) })} />
          </label>

          <label>
            {priceInputLabel(settings, 'Per drawer')}
            <input type="number" min={0} value={install.perDrawer} onChange={(e) => patchInstall({ perDrawer: Number(e.target.value) })} />
          </label>

          <label>
            {priceInputLabel(settings, 'Wall-mount premium / cupboard')}
            <input type="number" min={0} value={install.wallMountPremium} onChange={(e) => patchInstall({ wallMountPremium: Number(e.target.value) })} title="Added when unit mount type is wall" />
          </label>

          <label>
            {priceInputLabel(settings, 'Minimum job')}
            <input type="number" min={0} value={install.minimumJob} onChange={(e) => patchInstall({ minimumJob: Number(e.target.value) })} />
          </label>

          <label>
            {priceInputLabel(settings, 'Travel fee')}
            <input type="number" min={0} value={install.travelFee} onChange={(e) => patchInstall({ travelFee: Number(e.target.value) })} />
          </label>

        </div>

      </CollapsibleSection>

    </>

  );

}



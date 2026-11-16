import {
  getRunnerByIdForJob,
  getRunnerClearancesForJob,
  getRunnerGroupsForJob,
  usesGelmarCatalog,
} from '../lib/hardwarePricing';
import { EDGING_LABELS } from '../lib/constants';
import {
  DEFAULT_DRAWER_GAPS,
  DEFAULT_GAP_TO_DOOR_MM,
  drawerSizeSummary,
  isActiveDrawer,
  resolveDrawerBoxMaterialId,
  resolveDrawerFrontMaterialId,
  resolveDrawerGaps,
  resolveFrontQty,
  syncDrawerOpeningFromFront,
} from '../lib/drawerRules';
import { drawerBoxFrontBackWidthNote, drawerBoxSideDepthNote, DRAWER_BOX_FRONT_BACK_EDGING, DRAWER_BOX_SIDE_EDGING } from '../lib/drawerBoxRules';
import { maxDrawerOpeningHeight, minDrawerOpeningHeight, resolveFrontLayout, syncFrontLayoutToUnit } from '../lib/frontLayout';
import { extraDrawerCarcassSize } from '../lib/extraDrawerCarcass';
import { edgingMaterialIdForPattern, NO_EDGING_MATERIAL_ID } from '../lib/edgingPatternSync';
import { extraLayoutUnit } from '../lib/extrasRules';
import { FillerEdgingCheckboxes } from './FillerEdgingCheckboxes';
import { NumberInput } from './NumberInput';
import type { BedroomWallExtra, DrawerConfig, DrawerGaps, EdgingMaterial, EdgingPattern, Job, Material, Unit } from '../types';

function EdgingSelect({
  value,
  fallback,
  edgingMaterials,
  disabled,
  pattern,
  onChange,
}: {
  value: string;
  fallback: string;
  edgingMaterials: EdgingMaterial[];
  disabled?: boolean;
  pattern?: EdgingPattern;
  onChange: (id: string) => void;
}) {
  const noEdging = pattern === 'none';
  return (
    <select disabled={disabled || noEdging} value={noEdging ? NO_EDGING_MATERIAL_ID : value || fallback} onChange={(e) => onChange(e.target.value)}>
      {noEdging ? (
        <option value={NO_EDGING_MATERIAL_ID}>No edging</option>
      ) : (
        edgingMaterials.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} ({e.thickness} mm)
          </option>
        ))
      )}
    </select>
  );
}

function PatternSelect({
  value,
  disabled,
  onChange,
}: {
  value: EdgingPattern;
  disabled?: boolean;
  onChange: (v: EdgingPattern) => void;
}) {
  return (
    <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value as EdgingPattern)}>
      {Object.entries(EDGING_LABELS).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

function MaterialSelect({
  value,
  materials,
  disabled,
  onChange,
}: {
  value: string;
  materials: Material[];
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}>
      {materials.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

interface Props {
  index: number;
  job: Job;
  unit: Unit;
  extra: BedroomWallExtra;
  materials: Material[];
  edgingMaterials: EdgingMaterial[];
  settings: Job['settings'];
  disabled?: boolean;
  onChange: (extra: BedroomWallExtra) => void;
  onRemove: () => void;
}

export function ExtraInnerForm({
  index,
  job,
  unit,
  extra,
  materials,
  edgingMaterials,
  settings,
  disabled = false,
  onChange,
  onRemove,
}: Props) {
  const extraUnit = extraLayoutUnit(unit, extra);
  const layoutExtra = resolveFrontLayout(extraUnit);
  const drawerCarcass = extraDrawerCarcassSize(extra);
  const edgeFallback = edgingMaterials[0]?.id ?? '';
  const defaultEdgingForMaterial = (materialId: string) =>
    materials.find((m) => m.id === materialId)?.edgingMaterialId ?? edgeFallback;

  const patch = (next: BedroomWallExtra, syncDrawers = false) => {
    if (syncDrawers && next.drawersEnabled) {
      onChange({
        ...next,
        drawers: syncFrontLayoutToUnit(extraLayoutUnit(unit, next)).drawers,
      });
      return;
    }
    onChange(next);
  };

  const patternMaterialFields: Partial<Record<keyof BedroomWallExtra, keyof BedroomWallExtra>> = {
    edgingPattern: 'edgingMaterialId',
    topEdgingPattern: 'topEdgingMaterialId',
    shelfEdgingPattern: 'shelfEdgingMaterialId',
    divisionEdgingPattern: 'divisionEdgingMaterialId',
    fillerEdgingPattern: 'fillerEdgingMaterialId',
  };

  const defaultEdgingForPatternField = (patternField: keyof BedroomWallExtra): string => {
    switch (patternField) {
      case 'topEdgingPattern':
        return defaultEdgingForMaterial(extra.topMaterialId || extra.boxMaterialId);
      case 'shelfEdgingPattern':
        return defaultEdgingForMaterial(extra.shelfMaterialId || unit.carcass.shelfMaterialId);
      case 'divisionEdgingPattern':
        return defaultEdgingForMaterial(extra.divisionMaterialId);
      case 'fillerEdgingPattern':
        return defaultEdgingForMaterial(extra.fillerMaterialId);
      default:
        return defaultEdgingForMaterial(extra.boxMaterialId);
    }
  };

  const setField = <K extends keyof BedroomWallExtra>(field: K, value: BedroomWallExtra[K]) => {
    let next = { ...extra, [field]: value };
    const materialField = patternMaterialFields[field];
    if (materialField && typeof value === 'string') {
      const pattern = value as EdgingPattern;
      const fallback = defaultEdgingForPatternField(field);
      next = {
        ...next,
        [materialField]: edgingMaterialIdForPattern(
          pattern,
          next[materialField] as string | undefined,
          fallback,
        ),
      } as BedroomWallExtra;
    }
    patch(
      next,
      field === 'width' ||
        field === 'height' ||
        field === 'depth' ||
        field === 'drawerCarcassWidth' ||
        field === 'drawerCarcassHeight' ||
        field === 'drawerCarcassDepth',
    );
  };

  const addDrawer = () => {
    const newCount = extra.drawers.length + 1;
    const carcass = extraDrawerCarcassSize(extra);
    const equalShare = Math.round((carcass.height / newCount) * 10) / 10;
    const existing = extra.drawers.map((d) => ({ ...d, openingHeight: equalShare }));
    const gaps = { ...DEFAULT_DRAWER_GAPS, between: settings.defaultGap };
    const defaultMat = materials[0]?.id ?? '';
    const drawer: DrawerConfig = {
      id: crypto.randomUUID(),
      qty: 1,
      boxMaterialId: defaultMat,
      frontMaterialId: defaultMat,
      bottomType: 'masonite',
      boxHeight: 120,
      frontQty: 1,
      runner: { type: 'preset', presetId: 'blum-tandem' },
      openingWidth: carcass.width,
      openingHeight: extra.drawers.length === 0 ? carcass.height : equalShare,
      gaps,
      frontEdgingPattern: '2_long_2_short',
      frontEdgingMaterialId: defaultEdgingForMaterial(defaultMat),
      boxEdgingMaterialId: defaultEdgingForMaterial(defaultMat),
      gapToDoorMm: DEFAULT_GAP_TO_DOOR_MM,
      sideClearance: 13,
      frontClearance: 20,
      backClearance: 5,
    };
    const all = [...existing, drawer];
    const ready = syncDrawerOpeningFromFront(drawer, false, carcass.height, all);
    patch({ ...extra, drawersEnabled: true, drawers: [...existing, ready] }, true);
  };

  const updateDrawer = (id: string, drawerPatch: Partial<DrawerConfig>) => {
    const drawers = extra.drawers.map((d) => (d.id === id ? { ...d, ...drawerPatch } : d));
    patch({ ...extra, drawers }, true);
  };

  const updateDrawerGap = (id: string, field: keyof DrawerGaps, value: number) => {
    const drawer = extra.drawers.find((d) => d.id === id);
    if (!drawer) return;
    const gaps = resolveDrawerGaps(drawer);
    updateDrawer(id, { gaps: { ...gaps, [field]: Math.max(0, value) } });
  };

  const tooWide = extra.width > unit.width;
  const tooTall = extra.height > unit.height;
  const tooDeep = extra.depth > unit.depth;

  return (
    <fieldset className="sub-card extra-inner-fieldset" disabled={disabled}>
      <div className="sub-card-header">
        <strong>Extra inner unit {index + 1}</strong>
        <button type="button" className="btn btn-ghost btn-sm danger" onClick={onRemove} disabled={disabled}>
          Remove
        </button>
      </div>
      <p className="hint">
        Outer extra carcass (sides and bottom) from the sizes below. Optional top panel is sized separately. Drawers sit in their own typed carcass, same as a floor unit. No kickplate or feet.
        {(tooWide || tooTall || tooDeep) && (
          <> Inner size is larger than the outer carcass — cut list still uses what you typed.</>
        )}
      </p>
      <div className="form-grid form-grid-4">
        <label>
          Inner carcass width (mm)
          <NumberInput min={1} integer value={extra.width} onChange={(n) => setField('width', Math.max(1, n))} />
        </label>
        <label>
          Inner carcass height (mm)
          <NumberInput min={1} integer value={extra.height} onChange={(n) => setField('height', Math.max(1, n))} />
        </label>
        <label>
          Inner carcass depth (mm)
          <NumberInput min={1} integer value={extra.depth} onChange={(n) => setField('depth', Math.max(1, n))} />
        </label>
        <label>
          Inner box board
          <MaterialSelect
            value={extra.boxMaterialId || unit.carcass.leftMaterialId}
            materials={materials}
            onChange={(v) =>
              patch({
                ...extra,
                boxMaterialId: v,
                edgingMaterialId: defaultEdgingForMaterial(v),
              })
            }
          />
          <span className="field-hint">Inner sides and bottom — e.g. oak or white melamine</span>
        </label>
        <label>
          Box edging pattern
          <PatternSelect value={extra.edgingPattern} onChange={(v) => setField('edgingPattern', v)} />
        </label>
        <label>
          Box edging type
          <EdgingSelect
            pattern={extra.edgingPattern}
            value={extra.edgingMaterialId}
            fallback={edgeFallback}
            edgingMaterials={edgingMaterials}
            onChange={(v) => setField('edgingMaterialId', v)}
          />
          <span className="field-hint">Tape name and thickness for inner sides and bottom</span>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={extra.sideFillers}
            onChange={(e) => setField('sideFillers', e.target.checked)}
          />
          Side fillers
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={extra.topFillers}
            onChange={(e) => setField('topFillers', e.target.checked)}
          />
          Top fillers
        </label>
        <label>
          Filler board
          <MaterialSelect
            disabled={!extra.sideFillers && !extra.topFillers}
            value={extra.fillerMaterialId || unit.carcass.fillerMaterialId}
            materials={materials}
            onChange={(v) =>
              patch({
                ...extra,
                fillerMaterialId: v,
                fillerEdgingMaterialId: defaultEdgingForMaterial(v),
              })
            }
          />
        </label>
        <label>
          Filler edging type
          <EdgingSelect
            disabled={!extra.sideFillers && !extra.topFillers}
            value={extra.fillerEdgingMaterialId}
            fallback={edgeFallback}
            edgingMaterials={edgingMaterials}
            onChange={(v) => setField('fillerEdgingMaterialId', v)}
          />
        </label>
      </div>

      <h4 className="subsection-title">Top panel</h4>
      <div className="form-grid form-grid-4">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={extra.includeTop}
            onChange={(e) => {
              const on = e.target.checked;
              const internalW = Math.max(1, Math.round(extra.width) - 2 * settings.thickness);
              const depthMm = Math.max(1, Math.round(extra.depth));
              const lengthMm = Math.max(1, Math.round(extra.topLength || internalW));
              patch({
                ...extra,
                includeTop: on,
                topLength: lengthMm,
                topDepth: Math.max(1, Math.round(extra.topDepth || depthMm)),
                topQty: Math.max(1, Math.floor(extra.topQty ?? 1)),
                topMaterialId: extra.topMaterialId || extra.boxMaterialId || unit.carcass.leftMaterialId,
                topEdgingMaterialId:
                  extra.topEdgingMaterialId || extra.edgingMaterialId || defaultEdgingForMaterial(extra.boxMaterialId),
                topEdgingPattern: extra.topEdgingPattern || extra.edgingPattern || '1_long',
              });
            }}
          />
          Include top panel
        </label>
        <label>
          Quantity
          <NumberInput
            disabled={!extra.includeTop}
            min={1}
            integer
            value={extra.topQty ?? 1}
            onChange={(n) => setField('topQty', Math.max(1, n))}
          />
        </label>
        <label>
          Top length (mm)
          <NumberInput
            disabled={!extra.includeTop}
            min={1}
            integer
            value={Math.max(1, Math.round(extra.topLength || Math.max(1, extra.width - 2 * settings.thickness)))}
            onChange={(n) => setField('topLength', Math.max(1, n))}
          />
          <span className="field-hint">Front run — cut-list length</span>
        </label>
        <label>
          Top depth (mm)
          <NumberInput
            disabled={!extra.includeTop}
            min={1}
            integer
            value={Math.max(1, Math.round(extra.topDepth || extra.depth))}
            onChange={(n) => setField('topDepth', Math.max(1, n))}
          />
          <span className="field-hint">Front to back — cut-list width</span>
        </label>
        <label>
          Top board
          <MaterialSelect
            disabled={!extra.includeTop}
            value={extra.topMaterialId || extra.boxMaterialId || unit.carcass.leftMaterialId}
            materials={materials}
            onChange={(v) =>
              patch({
                ...extra,
                topMaterialId: v,
                topEdgingMaterialId: defaultEdgingForMaterial(v),
              })
            }
          />
        </label>
        <label>
          Top edging pattern
          <PatternSelect
            disabled={!extra.includeTop}
            value={extra.topEdgingPattern ?? '1_long'}
            onChange={(v) => setField('topEdgingPattern', v)}
          />
        </label>
        <label>
          Top edging type
          <EdgingSelect
            disabled={!extra.includeTop}
            pattern={extra.topEdgingPattern}
            value={extra.topEdgingMaterialId}
            fallback={edgeFallback}
            edgingMaterials={edgingMaterials}
            onChange={(v) => setField('topEdgingMaterialId', v)}
          />
        </label>
      </div>

      {extra.sideFillers && (
        <>
          <div className="form-grid form-grid-4">
            <label>
              Side filler qty
              <NumberInput min={1} integer value={extra.sideFillerQty} onChange={(n) => setField('sideFillerQty', Math.max(1, n))} />
            </label>
            <label>
              Side filler width (mm)
              <NumberInput min={1} integer value={extra.sideFillerWidth} onChange={(n) => setField('sideFillerWidth', Math.max(1, n))} />
              <span className="field-hint">Strip width (short side)</span>
            </label>
            <label>
              Side filler length (mm)
              <NumberInput min={1} integer value={extra.sideFillerHeight} onChange={(n) => setField('sideFillerHeight', Math.max(1, n))} />
              <span className="field-hint">Long side — 1 Long edging runs here</span>
            </label>
          </div>
          <FillerEdgingCheckboxes
            counts={{
              long: extra.sideFillerEdgingLongCount ?? 1,
              short: extra.sideFillerEdgingShortCount ?? 0,
            }}
            onChange={(next) =>
              patch({
                ...extra,
                sideFillerEdgingLongCount: next.long,
                sideFillerEdgingShortCount: next.short,
              })
            }
          />
        </>
      )}
      {extra.topFillers && (
        <>
          <div className="form-grid form-grid-4">
            <label>
              Top filler qty
              <NumberInput min={1} integer value={extra.topFillerQty} onChange={(n) => setField('topFillerQty', Math.max(1, n))} />
            </label>
            <label>
              Top filler width (mm)
              <NumberInput min={1} integer value={extra.topFillerWidth} onChange={(n) => setField('topFillerWidth', Math.max(1, n))} />
              <span className="field-hint">Strip width (short side)</span>
            </label>
            <label>
              Top filler length (mm)
              <NumberInput min={1} integer value={extra.topFillerHeight} onChange={(n) => setField('topFillerHeight', Math.max(1, n))} />
              <span className="field-hint">Long side — 1 Long edging runs here</span>
            </label>
          </div>
          <FillerEdgingCheckboxes
            counts={{
              long: extra.topFillerEdgingLongCount ?? 1,
              short: extra.topFillerEdgingShortCount ?? 0,
            }}
            onChange={(next) =>
              patch({
                ...extra,
                topFillerEdgingLongCount: next.long,
                topFillerEdgingShortCount: next.short,
              })
            }
          />
        </>
      )}

      <h4 className="subsection-title">Shelves</h4>
      <div className="form-grid form-grid-4">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={extra.shelvesEnabled}
            onChange={(e) => setField('shelvesEnabled', e.target.checked)}
          />
          Include shelves
        </label>
        <label>
          Shelf quantity
          <NumberInput
            disabled={!extra.shelvesEnabled}
            min={1}
            integer
            value={extra.shelfQty}
            onChange={(n) => setField('shelfQty', Math.max(1, n))}
          />
        </label>
        <label>
          Shelf length (mm)
          <NumberInput
            disabled={!extra.shelvesEnabled}
            min={1}
            integer
            value={extra.shelfWidth}
            onChange={(n) => setField('shelfWidth', Math.max(1, n))}
          />
          <span className="field-hint">Front run — 1 Long edging on this edge</span>
        </label>
        <label>
          Shelf width (mm)
          <NumberInput
            disabled={!extra.shelvesEnabled}
            min={1}
            integer
            value={extra.shelfHeight}
            onChange={(n) => setField('shelfHeight', Math.max(1, n))}
          />
          <span className="field-hint">Front to back (short side)</span>
        </label>
        <label>
          Shelf board
          <MaterialSelect
            disabled={!extra.shelvesEnabled}
            value={extra.shelfMaterialId || unit.carcass.shelfMaterialId}
            materials={materials}
            onChange={(v) =>
              patch({
                ...extra,
                shelfMaterialId: v,
                shelfEdgingMaterialId: defaultEdgingForMaterial(v),
              })
            }
          />
        </label>
        <label>
          Shelf edging pattern
          <PatternSelect
            disabled={!extra.shelvesEnabled}
            value={extra.shelfEdgingPattern}
            onChange={(v) => setField('shelfEdgingPattern', v)}
          />
        </label>
        <label>
          Shelf edging type
          <EdgingSelect
            disabled={!extra.shelvesEnabled}
            pattern={extra.shelfEdgingPattern}
            value={extra.shelfEdgingMaterialId}
            fallback={edgeFallback}
            edgingMaterials={edgingMaterials}
            onChange={(v) => setField('shelfEdgingMaterialId', v)}
          />
        </label>
      </div>

      <h4 className="subsection-title">Division panel</h4>
      <div className="form-grid form-grid-4">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={extra.divisionEnabled}
            onChange={(e) => setField('divisionEnabled', e.target.checked)}
          />
          Include division panel
        </label>
        <label>
          Quantity
          <NumberInput
            disabled={!extra.divisionEnabled}
            min={1}
            integer
            value={extra.divisionQty}
            onChange={(n) => setField('divisionQty', Math.max(1, n))}
          />
        </label>
        <label>
          Division width (mm)
          <NumberInput
            disabled={!extra.divisionEnabled}
            min={1}
            integer
            value={extra.divisionWidth}
            onChange={(n) => setField('divisionWidth', Math.max(1, n))}
          />
        </label>
        <label>
          Division height (mm)
          <NumberInput
            disabled={!extra.divisionEnabled}
            min={1}
            integer
            value={extra.divisionHeight}
            onChange={(n) => setField('divisionHeight', Math.max(1, n))}
          />
        </label>
        <label>
          Division board
          <MaterialSelect
            disabled={!extra.divisionEnabled}
            value={extra.divisionMaterialId || unit.carcass.leftMaterialId}
            materials={materials}
            onChange={(v) =>
              patch({
                ...extra,
                divisionMaterialId: v,
                divisionEdgingMaterialId: defaultEdgingForMaterial(v),
              })
            }
          />
        </label>
        <label>
          Division edging pattern
          <PatternSelect
            disabled={!extra.divisionEnabled}
            value={extra.divisionEdgingPattern}
            onChange={(v) => setField('divisionEdgingPattern', v)}
          />
        </label>
        <label>
          Division edging type
          <EdgingSelect
            disabled={!extra.divisionEnabled}
            pattern={extra.divisionEdgingPattern}
            value={extra.divisionEdgingMaterialId}
            fallback={edgeFallback}
            edgingMaterials={edgingMaterials}
            onChange={(v) => setField('divisionEdgingMaterialId', v)}
          />
        </label>
      </div>

      <h4 className="subsection-title">Drawer boxes</h4>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={extra.drawersEnabled}
          onChange={(e) => {
            const on = e.target.checked;
            patch(
              {
                ...extra,
                drawersEnabled: on,
                drawerCarcassWidth: extra.drawerCarcassWidth || extra.width,
                drawerCarcassHeight: extra.drawerCarcassHeight || extra.height,
                drawerCarcassDepth: extra.drawerCarcassDepth || extra.depth,
              },
              on,
            );
          }}
        />
        Include drawers
      </label>
      <p className="hint">
        Type the drawer carcass W × H × D (the box the drawers sit in) and how many identical boxes. Drawer boxes are calculated from that size minus board thickness and runner side clearance, same as a floor unit; qty multiplies all drawer rows for this extra.
      </p>
      {extra.drawersEnabled && (
        <div className="form-grid form-grid-4">
          <label>
            Drawer carcass width (mm)
            <NumberInput
              min={1}
              integer
              value={drawerCarcass.width}
              onChange={(n) => setField('drawerCarcassWidth', Math.max(1, n))}
            />
          </label>
          <label>
            Drawer carcass height (mm)
            <NumberInput
              min={1}
              integer
              value={drawerCarcass.height}
              onChange={(n) => setField('drawerCarcassHeight', Math.max(1, n))}
            />
          </label>
          <label>
            Drawer carcass depth (mm)
            <NumberInput
              min={1}
              integer
              value={drawerCarcass.depth}
              onChange={(n) => setField('drawerCarcassDepth', Math.max(1, n))}
            />
          </label>
          <label>
            Qty
            <NumberInput
              min={0}
              integer
              value={extra.drawerCarcassQty ?? 1}
              onChange={(n) => setField('drawerCarcassQty', Math.max(0, n))}
            />
          </label>
        </div>
      )}
      {extra.drawersEnabled && extra.drawers.length === 0 && (
        <p className="hint">No drawer rows yet. Click + Add drawers for this inner unit.</p>
      )}
      {extra.drawersEnabled &&
        extra.drawers.map((drawer, i) => {
          const layoutDrawer = layoutExtra.drawers.find((d) => d.id === drawer.id) ?? drawer;
          return (
            <div key={drawer.id} className="sub-card">
              <div className="sub-card-header">
                <strong>Drawer row {i + 1}</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm danger"
                  onClick={() => patch({ ...extra, drawers: extra.drawers.filter((d) => d.id !== drawer.id) }, true)}
                >
                  Remove
                </button>
              </div>
              <div className="form-grid form-grid-4">
                <label className={drawer.qty <= 0 ? 'qty-inactive' : ''}>
                  Qty per cupboard
                  <NumberInput min={0} value={drawer.qty} onChange={(n) => updateDrawer(drawer.id, { qty: Math.max(0, n) })} />
                </label>
                <label>
                  Opening width (mm)
                  <input
                    type="number"
                    className="readonly"
                    value={layoutDrawer.openingWidth}
                    readOnly
                    title="Matches drawer carcass width"
                  />
                </label>
                <label>
                  Opening height (mm)
                  <NumberInput
                    className={isActiveDrawer(drawer) ? 'readonly' : ''}
                    min={minDrawerOpeningHeight(drawer, false, extraUnit)}
                    max={maxDrawerOpeningHeight(extraUnit, drawer.id)}
                    value={layoutDrawer.openingHeight}
                    readOnly={isActiveDrawer(drawer)}
                    title="Share of drawer carcass height (floor-unit stack)"
                    onChange={(n) => updateDrawer(drawer.id, { openingHeight: Math.max(1, n) })}
                  />
                </label>
                <label>
                  Box height (mm)
                  <NumberInput min={1} value={drawer.boxHeight} onChange={(n) => updateDrawer(drawer.id, { boxHeight: Math.max(1, n) })} />
                </label>
                <label>
                  Bottom backing
                  <select
                    value={drawer.bottomType}
                    onChange={(e) => updateDrawer(drawer.id, { bottomType: e.target.value as DrawerConfig['bottomType'] })}
                  >
                    <option value="masonite">Masonite</option>
                    <option value="solid">Solid melamine</option>
                  </select>
                </label>
                <label>
                  Drawer box material
                  <select
                    value={resolveDrawerBoxMaterialId(drawer)}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateDrawer(drawer.id, { boxMaterialId: v, boxEdgingMaterialId: defaultEdgingForMaterial(v) });
                    }}
                  >
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Box edging type
                  <EdgingSelect
                    value={drawer.boxEdgingMaterialId ?? defaultEdgingForMaterial(resolveDrawerBoxMaterialId(drawer))}
                    fallback={edgeFallback}
                    edgingMaterials={edgingMaterials}
                    onChange={(v) => updateDrawer(drawer.id, { boxEdgingMaterialId: v })}
                  />
                </label>
                <label>
                  Drawer front material
                  <select
                    value={resolveDrawerFrontMaterialId(drawer)}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateDrawer(drawer.id, { frontMaterialId: v, frontEdgingMaterialId: defaultEdgingForMaterial(v) });
                    }}
                  >
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Front edging pattern
                  <PatternSelect
                    value={drawer.frontEdgingPattern}
                    onChange={(v) => updateDrawer(drawer.id, { frontEdgingPattern: v })}
                  />
                </label>
                <label>
                  Front edging type
                  <EdgingSelect
                    value={drawer.frontEdgingMaterialId}
                    fallback={edgeFallback}
                    edgingMaterials={edgingMaterials}
                    onChange={(v) => updateDrawer(drawer.id, { frontEdgingMaterialId: v })}
                  />
                </label>
                <label className="runner-select-label">
                  Runner
                  <select
                    className="runner-select"
                    value={drawer.runner.type === 'preset' ? drawer.runner.presetId : 'custom'}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        updateDrawer(drawer.id, {
                          runner: { type: 'custom', customSideClearance: drawer.sideClearance, customDepthDeduction: 25 },
                        });
                      } else {
                        const entry = getRunnerByIdForJob(job, e.target.value);
                        updateDrawer(drawer.id, {
                          runner: { type: 'preset', presetId: e.target.value },
                          sideClearance: entry?.sideClearance ?? drawer.sideClearance,
                        });
                      }
                    }}
                  >
                    {getRunnerGroupsForJob(job).map((group) => (
                      <optgroup key={group.category} label={group.label}>
                        {group.runners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.shortName}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    {usesGelmarCatalog(job, 'runners') && <option value="custom">Custom clearances</option>}
                  </select>
                </label>
              </div>
              <p className="hint">
                Box front/back ({EDGING_LABELS[DRAWER_BOX_FRONT_BACK_EDGING]}):{' '}
                {drawerBoxFrontBackWidthNote(
                  drawerCarcass.width,
                  settings.thickness,
                  drawer.sideClearance ?? getRunnerClearancesForJob(job, drawer.runner).sideClearance,
                )}
              </p>
              <p className="hint">
                Box sides ({EDGING_LABELS[DRAWER_BOX_SIDE_EDGING]}):{' '}
                {drawerBoxSideDepthNote(drawerCarcass.depth, drawer.backClearance ?? 5, settings.thickness)} × box height
              </p>
              <h4 className="subsection-title">Drawer front gaps (mm)</h4>
              <div className="form-grid form-grid-5 door-gaps-grid">
                <label>
                  Left
                  <NumberInput min={0} step={0.5} value={resolveDrawerGaps(drawer).left} onChange={(n) => updateDrawerGap(drawer.id, 'left', n)} />
                </label>
                <label>
                  Right
                  <NumberInput min={0} step={0.5} value={resolveDrawerGaps(drawer).right} onChange={(n) => updateDrawerGap(drawer.id, 'right', n)} />
                </label>
                <label>
                  Top
                  <NumberInput min={0} step={0.5} value={resolveDrawerGaps(drawer).top} onChange={(n) => updateDrawerGap(drawer.id, 'top', n)} />
                </label>
                <label>
                  Bottom
                  <NumberInput min={0} step={0.5} value={resolveDrawerGaps(drawer).bottom} onChange={(n) => updateDrawerGap(drawer.id, 'bottom', n)} />
                </label>
                {resolveFrontQty(drawer) > 1 && (
                  <label>
                    Between fronts
                    <NumberInput min={0} step={0.5} value={resolveDrawerGaps(drawer).between} onChange={(n) => updateDrawerGap(drawer.id, 'between', n)} />
                  </label>
                )}
              </div>
              <p className="hint">{drawerSizeSummary(layoutDrawer, { settings, edgingMaterials, materials }, false, drawerCarcass.height, extra.drawers)}</p>
              <div className="form-grid form-grid-3 drawer-clearances">
                <label>
                  Side clearance (mm)
                  <NumberInput
                    min={0}
                    step={0.1}
                    value={drawer.sideClearance ?? getRunnerClearancesForJob(job, drawer.runner).sideClearance}
                    onChange={(n) => {
                      updateDrawer(drawer.id, {
                        sideClearance: n,
                        runner: drawer.runner.type === 'custom' ? { ...drawer.runner, customSideClearance: n } : drawer.runner,
                      });
                    }}
                  />
                </label>
                <label>
                  Front clearance (mm)
                  <NumberInput min={0} value={drawer.frontClearance} onChange={(n) => updateDrawer(drawer.id, { frontClearance: n })} />
                </label>
                <label>
                  Back clearance (mm)
                  <NumberInput min={0} value={drawer.backClearance} onChange={(n) => updateDrawer(drawer.id, { backClearance: n })} />
                </label>
              </div>
            </div>
          );
        })}
      {extra.drawersEnabled && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={addDrawer} disabled={disabled}>
          + Add drawers
        </button>
      )}
    </fieldset>
  );
}

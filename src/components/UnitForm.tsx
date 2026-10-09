import { useState, type MouseEvent, type PointerEvent } from 'react';
import { CupboardViewer } from './CupboardViewer';
import { defaultPlinth, BACKING_LABELS, COUNTERTOP_LABELS, CUT_SIZE_MODE_LABELS, EDGING_LABELS, DEFAULT_HINGE_PRESET_ID, getHingeById, getHingeGroups, getRunnerClearances, getRunnerGroups, isFloorUnit, isKitchenBase, KICKPLATE_COVERAGE_LABELS, KICKPLATE_TYPE_LABELS, MOUNT_TYPE_LABELS, UNIT_TYPE_LABELS } from '../lib/constants';
import { getRunnerById } from '../lib/runnerCatalog';
import { doorSizeSummary, DEFAULT_DOOR_GAPS, hingesPerDoorLeafForDoor, resolveDoorGaps } from '../lib/doorRules';
import { drawerSizeSummary, DEFAULT_DRAWER_GAPS, DEFAULT_FRONT_OVERHANG_MM, DEFAULT_GAP_TO_DOOR_MM, isActiveDrawer, activeDrawers, resolveDrawerBoxMaterialId, resolveDrawerFrontMaterialId, resolveDrawerGaps, resolveFrontOverhang, resolveFrontQty, resolveGapToDoor, syncDrawerOpeningFromFront } from '../lib/drawerRules';
import { drawerBoxFrontBackWidthNote, drawerBoxSideDepthNote, DRAWER_BOX_FRONT_BACK_EDGING, DRAWER_BOX_SIDE_EDGING } from '../lib/drawerBoxRules';
import { defaultDrawerOpeningHeight, maxDrawerOpeningHeight, minDrawerOpeningHeight, resolveFrontLayout, syncFrontLayoutToUnit, totalDrawerOpeningHeight, totalDoorOpeningHeight } from '../lib/frontLayout';
import { fillersFollowSideMaterial, resolveFillerMaterial } from '../lib/carcassRules';
import { kickplateRunLengthMm } from '../lib/kickplateRules';
import { deletePreset, loadPresets, saveUnitAsPreset } from '../lib/presets';
import { CollapsibleSection } from './CollapsibleSection';
import type { DoorConfig, DoorGaps, DrawerConfig, DrawerGaps, EdgingMaterial, EdgingPattern, Job, Material, Unit } from '../types';

interface Props {
  unit: Unit;
  materials: Material[];
  edgingMaterials: EdgingMaterial[];
  settings: Job['settings'];
  onChange: (unit: Unit) => void;
  onRemove: () => void;
}

function MaterialSelect({
  value,
  materials,
  onChange,
}: {
  value: string;
  materials: Material[];
  onChange: (id: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {materials.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  );
}

function EdgingTypeSelect({
  value,
  fallbackMaterialId,
  materials,
  edgingMaterials,
  onChange,
}: {
  value: string | undefined;
  fallbackMaterialId: string;
  materials: Material[];
  edgingMaterials: EdgingMaterial[];
  onChange: (id: string) => void;
}) {
  const fallback = materials.find((m) => m.id === fallbackMaterialId)?.edgingMaterialId ?? edgingMaterials[0]?.id ?? '';
  return (
    <select value={value ?? fallback} onChange={(e) => onChange(e.target.value)}>
      {edgingMaterials.map((e) => (
        <option key={e.id} value={e.id}>{e.name} ({e.thickness} mm)</option>
      ))}
    </select>
  );
}

export function UnitForm({ unit, materials, edgingMaterials, settings, onChange, onRemove }: Props) {
  const [presets, setPresets] = useState(loadPresets);
  const layoutUnit = resolveFrontLayout(unit);
  const activeDrawerRows = activeDrawers(layoutUnit.drawers);
  const hasActiveDrawers = activeDrawerRows.length > 0;

  const applyUnit = (next: Unit, opts?: { changedDrawerId?: string }) =>
    onChange(syncFrontLayoutToUnit(next, opts));

  const set = <K extends keyof Unit>(field: K, value: Unit[K]) => {
    if (field === 'width' || field === 'height' || field === 'depth') {
      applyUnit({ ...unit, [field]: value });
      return;
    }
    onChange({ ...unit, [field]: value });
  };
  const setCarcass = (field: keyof Unit['carcass'], value: Unit['carcass'][typeof field]) =>
    onChange({ ...unit, carcass: { ...unit.carcass, [field]: value } });

  const setPlinth = (field: keyof NonNullable<Unit['plinth']>, value: string | number | boolean) => {
    const plinth = unit.plinth ?? defaultPlinth({ settings, materials }, unit.carcass.leftMaterialId);
    onChange({ ...unit, plinth: { ...plinth, [field]: value } });
  };

  const handleTypeChange = (type: Unit['type']) => {
    const mountType = type === 'wall' ? 'wall' : unit.carcass.mountType ?? 'floor';
    if (isKitchenBase(type)) {
      onChange({
        ...unit,
        type,
        carcass: { ...unit.carcass, mountType: mountType === 'wall' ? 'floor' : mountType },
        plinth: unit.plinth ?? defaultPlinth({ settings, materials }, unit.carcass.leftMaterialId),
      });
    } else {
      const { plinth: _, ...rest } = unit;
      onChange({
        ...rest,
        type,
        carcass: { ...unit.carcass, mountType: type === 'wall' ? 'wall' : mountType },
      });
    }
  };

  const handleMountChange = (mountType: Unit['carcass']['mountType']) => {
    const next = { ...unit, carcass: { ...unit.carcass, mountType } };
    if (mountType === 'floor' && isKitchenBase(unit.type) && !next.plinth) {
      next.plinth = defaultPlinth({ settings, materials }, unit.carcass.leftMaterialId);
    }
    onChange(next);
  };

  const isFloor = isFloorUnit(unit);

  const defaultMat = materials[0]?.id ?? '';
  const fillerFromSides = fillersFollowSideMaterial(unit.carcass, materials);
  const effectiveFillerId = resolveFillerMaterial(unit.carcass, materials);
  const effectiveFillerName = materials.find((m) => m.id === effectiveFillerId)?.name ?? '—';

  const handleSavePreset = () => {
    const name = prompt('Preset name (e.g. 600 Base with 1 shelf):', unit.name);
    if (!name?.trim()) return;
    saveUnitAsPreset(unit, name.trim());
    setPresets(loadPresets());
    alert(`Preset "${name.trim()}" saved. Use "Add from preset" to reuse it.`);
  };

  const defaultEdgingForMaterial = (materialId: string) => {
    const mat = materials.find((m) => m.id === materialId);
    return mat?.edgingMaterialId ?? edgingMaterials[0]?.id ?? '';
  };

  const addDoor = () => {
    const door: DoorConfig = {
      id: crypto.randomUUID(),
      qty: 1,
      materialId: defaultMat,
      edgingPattern: '2_long_2_short',
      edgingMaterialId: defaultEdgingForMaterial(defaultMat),
      openingWidth: unit.width,
      openingHeight: unit.height,
      gaps: { ...DEFAULT_DOOR_GAPS, between: settings.defaultGap },
      hinge: { type: 'preset', presetId: DEFAULT_HINGE_PRESET_ID },
    };
    applyUnit({ ...unit, doors: [...unit.doors, door] });
  };

  const addDrawer = () => {
    const hasDoor = unit.doors.length > 0;
    const newCount = unit.drawers.length + 1;
    const equalShare = Math.round((unit.height / newCount) * 10) / 10;
    const existingDrawers = hasDoor
      ? unit.drawers
      : unit.drawers.map((d) => ({ ...d, openingHeight: equalShare }));
    const gaps = { ...DEFAULT_DRAWER_GAPS, between: settings.defaultGap };
    const drawer: DrawerConfig = {
      id: crypto.randomUUID(),
      qty: 1,
      boxMaterialId: defaultMat,
      frontMaterialId: defaultMat,
      bottomType: 'masonite',
      boxHeight: 120,
      frontOverhangMm: DEFAULT_FRONT_OVERHANG_MM,
      frontQty: 1,
      runner: { type: 'preset', presetId: 'blum-tandem' },
      openingWidth: unit.width,
      openingHeight: hasDoor ? defaultDrawerOpeningHeight(unit) : equalShare,
      gaps,
      frontEdgingPattern: '2_long_2_short',
      frontEdgingMaterialId: defaultEdgingForMaterial(defaultMat),
      boxEdgingMaterialId: defaultEdgingForMaterial(defaultMat),
      gapToDoorMm: DEFAULT_GAP_TO_DOOR_MM,
      sideClearance: 13,
      frontClearance: 20,
      backClearance: 5,
    };
    const ready = syncDrawerOpeningFromFront(drawer, unit.doors.length > 0);
    applyUnit({ ...unit, drawers: [...existingDrawers, ready] });
  };

  const setDrawerQty = (id: string, qty: number) => {
    updateDrawer(id, { qty: Math.max(0, qty) });
  };

  const updateDoorGap = (id: string, field: keyof DoorGaps, value: number) => {
    const door = unit.doors.find((d) => d.id === id);
    if (!door) return;
    const gaps = resolveDoorGaps(door);
    updateDoor(id, { gaps: { ...gaps, [field]: Math.max(0, value) } });
  };

  const updateDrawerGap = (id: string, field: keyof DrawerGaps, value: number) => {
    const drawer = unit.drawers.find((d) => d.id === id);
    if (!drawer) return;
    const gaps = resolveDrawerGaps(drawer);
    updateDrawer(id, { gaps: { ...gaps, [field]: Math.max(0, value) } });
  };

  const updateDoor = (id: string, patch: Partial<DoorConfig>) => {
    const doors = unit.doors.map((d) => (d.id === id ? { ...d, ...patch } : d));
    applyUnit({ ...unit, doors });
  };

  const updateDrawer = (id: string, patch: Partial<DrawerConfig>, opts?: { changedDrawerId?: string }) => {
    const drawers = unit.drawers.map((d) => (d.id === id ? { ...d, ...patch } : d));
    applyUnit({ ...unit, drawers }, opts?.changedDrawerId ? { changedDrawerId: opts.changedDrawerId } : undefined);
  };

  const setDrawerOpeningHeight = (id: string, value: number) => {
    updateDrawer(id, { openingHeight: Math.max(1, value) }, { changedDrawerId: id });
  };

  const isOnCutList = (unit.unitQty ?? 0) > 0;
  const stopSummaryToggle = (e: MouseEvent | PointerEvent) => e.stopPropagation();

  return (
    <section className={`card unit-card${isOnCutList ? '' : ' unit-inactive'}`}>
      <div className="unit-header-row">
        <input className="unit-name-input" value={unit.name} onChange={(e) => set('name', e.target.value)} />
        <label className="unit-qty-inline qty-highlight" onClick={stopSummaryToggle} onPointerDown={stopSummaryToggle}>
          Cupboard qty
          <input
            type="number"
            min={0}
            value={unit.unitQty}
            onChange={(e) => set('unitQty', Math.max(0, Number(e.target.value)))}
          />
        </label>
        <div className="unit-header-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleSavePreset}>Save as preset</button>
          <button type="button" className="btn btn-ghost btn-sm danger" onClick={onRemove}>Remove unit</button>
        </div>
      </div>
      {!isOnCutList && (
        <p className="hint unit-excluded-hint">Excluded from cut list — set quantity to 1 or more to include this unit.</p>
      )}
      {unit.unitQty > 1 && (
        <p className="hint qty-note">Cut list will multiply all parts × {unit.unitQty} identical cupboards.</p>
      )}

      <details className="detail-breakdown collapsible-section collapsible-subsection unit-settings-details" open={isOnCutList}>
        <summary>
          Unit settings — {unit.width} × {unit.height} × {unit.depth} mm
          {!isOnCutList && <span className="unit-settings-badge">inactive</span>}
        </summary>

        <div className="form-grid form-grid-4">
          <label>
            Unit type
            <select value={unit.type} onChange={(e) => handleTypeChange(e.target.value as Unit['type'])}>
              {Object.entries(UNIT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Mount
            <select value={unit.carcass.mountType ?? 'floor'} onChange={(e) => handleMountChange(e.target.value as Unit['carcass']['mountType'])}>
              {Object.entries(MOUNT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Width (mm)
            <input type="number" value={unit.width} onChange={(e) => set('width', Number(e.target.value))} />
          </label>
          <label>
            Height (mm)
            <input type="number" value={unit.height} onChange={(e) => set('height', Number(e.target.value))} />
          </label>
          <label>
            Depth (mm)
            <input type="number" value={unit.depth} onChange={(e) => set('depth', Number(e.target.value))} />
          </label>
        </div>

        <CupboardViewer unit={layoutUnit} thickness={settings.thickness} materials={materials} />

      {isKitchenBase(unit.type) && isFloor && unit.plinth && (
        <CollapsibleSection title="Kitchen plinth — kickplate & feet" variant="nested">
          <div className="form-grid form-grid-4">
            <label>
              Kickplate type
              <select value={unit.plinth.kickplateType ?? 'wood'} onChange={(e) => setPlinth('kickplateType', e.target.value)}>
                {Object.entries(KICKPLATE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Kickplate coverage
              <select value={unit.plinth.kickplateCoverage ?? 'front'} onChange={(e) => setPlinth('kickplateCoverage', e.target.value)}>
                {Object.entries(KICKPLATE_COVERAGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            {unit.plinth.kickplateCoverage === 'front-one-side' && (
              <label>
                Side return
                <select value={unit.plinth.kickplateSide ?? 'left'} onChange={(e) => setPlinth('kickplateSide', e.target.value)}>
                  <option value="left">Left side</option>
                  <option value="right">Right side</option>
                </select>
              </label>
            )}
            {unit.plinth.kickplateType === 'wood' && (
              <label>
                Kickplate board material
                <MaterialSelect value={unit.plinth.kickplateMaterialId} materials={materials} onChange={(v) => setPlinth('kickplateMaterialId', v)} />
              </label>
            )}
            <label>
              Kickplate height (mm)
              <input type="number" min={80} max={200} value={unit.plinth.kickplateHeight} onChange={(e) => setPlinth('kickplateHeight', Number(e.target.value))} />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={unit.plinth.feetRequired !== false} onChange={(e) => setPlinth('feetRequired', e.target.checked)} />
              Plastic feet required
            </label>
            {unit.plinth.feetRequired !== false && (
              <label>
                Adjustable feet per cupboard
                <input type="number" min={2} max={8} value={unit.plinth.feetPerUnit} onChange={(e) => setPlinth('feetPerUnit', Number(e.target.value))} />
              </label>
            )}
          </div>
          <p className="hint">
            {unit.plinth.kickplateType === 'wood' ? (
              <>Wood kickplate: cut list includes board pieces with edging on visible long edge.</>
            ) : (
              <>Plastic kickplate: {kickplateRunLengthMm(unit.width, unit.depth, unit.plinth.kickplateCoverage ?? 'front')} mm run per cupboard
                {unit.unitQty > 1 ? ` × ${unit.unitQty} = ${(kickplateRunLengthMm(unit.width, unit.depth, unit.plinth.kickplateCoverage ?? 'front') * unit.unitQty / 1000).toFixed(2)} m total` : ''}.
                Set strip size &amp; price under Materials.</>
            )}
          </p>
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Carcass" variant="nested">
      {!isFloor && (
        <p className="hint">Wall unit: 2 top fillers (front + back) and an extra bottom panel ({unit.depth} × {unit.width - 2 * settings.thickness} mm). No kickplate or feet.</p>
      )}
      <div className="carcass-sides">
        <div className="side-column">
          <label>
            Left side material
            <MaterialSelect
              value={unit.carcass.leftMaterialId}
              materials={materials}
              onChange={(v) => onChange({
                ...unit,
                carcass: {
                  ...unit.carcass,
                  leftMaterialId: v,
                  leftEdgingMaterialId: defaultEdgingForMaterial(v),
                },
              })}
            />
          </label>
          <label>
            Left side edging type
            <EdgingTypeSelect
              value={unit.carcass.leftEdgingMaterialId}
              fallbackMaterialId={unit.carcass.leftMaterialId}
              materials={materials}
              edgingMaterials={edgingMaterials}
              onChange={(v) => setCarcass('leftEdgingMaterialId', v)}
            />
          </label>
          <label className="checkbox-label side-checkbox">
            <input type="checkbox" checked={unit.carcass.leftVisible} onChange={(e) => setCarcass('leftVisible', e.target.checked)} />
            Left side visible (1 long edge on front)
          </label>
        </div>
        <div className="side-column">
          <label>
            Right side material
            <MaterialSelect
              value={unit.carcass.rightMaterialId}
              materials={materials}
              onChange={(v) => onChange({
                ...unit,
                carcass: {
                  ...unit.carcass,
                  rightMaterialId: v,
                  rightEdgingMaterialId: defaultEdgingForMaterial(v),
                },
              })}
            />
          </label>
          <label>
            Right side edging type
            <EdgingTypeSelect
              value={unit.carcass.rightEdgingMaterialId}
              fallbackMaterialId={unit.carcass.rightMaterialId}
              materials={materials}
              edgingMaterials={edgingMaterials}
              onChange={(v) => setCarcass('rightEdgingMaterialId', v)}
            />
          </label>
          <label className="checkbox-label side-checkbox">
            <input type="checkbox" checked={unit.carcass.rightVisible} onChange={(e) => setCarcass('rightVisible', e.target.checked)} />
            Right side visible (1 long edge on front)
          </label>
        </div>
      </div>
      <div className="form-grid form-grid-3">
        <label>
          Bottom material
          <MaterialSelect
            value={unit.carcass.bottomMaterialId}
            materials={materials}
            onChange={(v) => onChange({
              ...unit,
              carcass: {
                ...unit.carcass,
                bottomMaterialId: v,
                bottomEdgingMaterialId: defaultEdgingForMaterial(v),
              },
            })}
          />
        </label>
        <label>
          Bottom edging type
          <EdgingTypeSelect
            value={unit.carcass.bottomEdgingMaterialId}
            fallbackMaterialId={unit.carcass.bottomMaterialId}
            materials={materials}
            edgingMaterials={edgingMaterials}
            onChange={(v) => setCarcass('bottomEdgingMaterialId', v)}
          />
        </label>
        {isFloor && (
          <label>
            Countertop type
            <select value={unit.carcass.countertopType ?? 'granite'} onChange={(e) => setCarcass('countertopType', e.target.value as Unit['carcass']['countertopType'])}>
              {Object.entries(COUNTERTOP_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Carcass backing
          <select value={unit.carcass.backingType ?? 'none'} onChange={(e) => setCarcass('backingType', e.target.value as Unit['carcass']['backingType'])}>
            {Object.entries(BACKING_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        {unit.carcass.backingType === 'melamine' && (
          <label>
            Backing material
            <MaterialSelect value={unit.carcass.backingMaterialId ?? defaultMat} materials={materials} onChange={(v) => setCarcass('backingMaterialId', v)} />
          </label>
        )}
        {fillerFromSides ? (
          <label className="readonly-label">
            Top filler material
            <input value={effectiveFillerName} readOnly className="readonly" />
            <span className="hint-inline">Auto — matches side panels (sides not both white melamine)</span>
          </label>
        ) : (
          <label>
            Filler material
            <MaterialSelect
              value={unit.carcass.fillerMaterialId}
              materials={materials}
              onChange={(v) => onChange({
                ...unit,
                carcass: {
                  ...unit.carcass,
                  fillerMaterialId: v,
                  fillerEdgingMaterialId: defaultEdgingForMaterial(v),
                },
              })}
            />
            <span className="hint-inline">Both sides white melamine — fillers can differ</span>
          </label>
        )}
        <label>
          Filler edging type
          <EdgingTypeSelect
            value={unit.carcass.fillerEdgingMaterialId}
            fallbackMaterialId={fillerFromSides ? effectiveFillerId : unit.carcass.fillerMaterialId}
            materials={materials}
            edgingMaterials={edgingMaterials}
            onChange={(v) => setCarcass('fillerEdgingMaterialId', v)}
          />
          <span className="hint-inline">Front &amp; back top fillers{unit.carcass.countertopType === 'wooden' ? ' + full top panel' : ''}</span>
        </label>
        <label>
          Filler width (mm)
          <input type="number" value={unit.carcass.fillerWidth} onChange={(e) => setCarcass('fillerWidth', Number(e.target.value))} />
        </label>
      </div>
      {isFloor && (unit.carcass.backingType === 'melamine' || unit.carcass.countertopType === 'wooden') && (
        <p className="hint">
          {unit.carcass.backingType === 'melamine' && (
            <>Melamine back: {unit.width - 2 * settings.thickness} × {unit.height - settings.thickness} mm (inside carcass).</>
          )}
          {unit.carcass.backingType === 'melamine' && unit.carcass.countertopType === 'wooden' && ' '}
          {unit.carcass.countertopType === 'wooden' && (
            <>Wooden top: 3 fillers — front rail, back rail, plus full top panel ({unit.width - 2 * settings.thickness} × {unit.depth} mm).</>
          )}
        </p>
      )}
      </CollapsibleSection>

      <CollapsibleSection title="Shelves" variant="nested">
        <div className="form-grid form-grid-3">
          <label>
            Shelf quantity
            <input type="number" min={0} value={unit.carcass.shelfQty} onChange={(e) => setCarcass('shelfQty', Number(e.target.value))} />
          </label>
          <label>
            Shelf material
            <MaterialSelect
              value={unit.carcass.shelfMaterialId}
              materials={materials}
              onChange={(v) => onChange({
                ...unit,
                carcass: {
                  ...unit.carcass,
                  shelfMaterialId: v,
                  shelfEdgingMaterialId: defaultEdgingForMaterial(v),
                },
              })}
            />
          </label>
          <label>
            Shelf edging type
            <EdgingTypeSelect
              value={unit.carcass.shelfEdgingMaterialId}
              fallbackMaterialId={unit.carcass.shelfMaterialId}
              materials={materials}
              edgingMaterials={edgingMaterials}
              onChange={(v) => setCarcass('shelfEdgingMaterialId', v)}
            />
          </label>
        </div>
        <p className="hint">Shelves: {unit.depth} × {unit.width - 2 * settings.thickness} mm · 1 long edge front ({EDGING_LABELS['1_long']}).</p>
      </CollapsibleSection>

      <CollapsibleSection title="Doors" variant="nested">
      <p className="hint">
        Cut list mode: <strong>{CUT_SIZE_MODE_LABELS[settings.cutSizeMode ?? 'final']}</strong>
        {(settings.cutSizeMode ?? 'final') === 'net'
          ? ' — finished sizes shown below; cut list deducts edging tape thickness from board.'
          : ' — cut list matches finished panel sizes (edging included in dimensions).'}
      </p>
      {(unit.doors.length > 0 || unit.drawers.length > 0) && (
        <p className="hint">
          Opening width follows cupboard width ({unit.width} mm). Finished door width = width − left − right gaps.
          {hasActiveDrawers && unit.doors.length > 0 && (
            <> Active drawer rows: {totalDrawerOpeningHeight(layoutUnit)} mm · Door opening: {totalDoorOpeningHeight(layoutUnit)} mm · Finished door H = opening − top − bottom gaps.</>
          )}
          {!hasActiveDrawers && unit.doors.length > 0 && (
            <> No active drawers (qty 0) — door uses full carcass height ({unit.height} mm).</>
          )}
        </p>
      )}
      {unit.doors.length === 0 && <p className="hint">No doors on this unit.</p>}
      {unit.doors.map((door, i) => {
        const layoutDoor = layoutUnit.doors.find((d) => d.id === door.id) ?? door;
        const doorOpeningAuto = hasActiveDrawers || unit.doors.length === 1;
        return (
        <div key={door.id} className="sub-card">
          <div className="sub-card-header">
            <strong>Door set {i + 1}</strong>
            <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => applyUnit({ ...unit, doors: unit.doors.filter((d) => d.id !== door.id) })}>Remove</button>
          </div>
          <div className="form-grid form-grid-4">
            <label>Qty per cupboard<input type="number" min={1} value={door.qty} onChange={(e) => updateDoor(door.id, { qty: Number(e.target.value) })} /></label>
            <label>
              Hinges / door
              <input
                type="text"
                className="readonly"
                readOnly
                value={`${hingesPerDoorLeafForDoor(layoutDoor)} (auto from finished height)`}
                title="≤1.2 m → 2 · >1.2–1.5 m → 3 · >1.5–2 m → 4"
              />
            </label>
            <label>
              Opening width (mm)
              <input type="number" className="readonly" value={layoutDoor.openingWidth} readOnly title="Matches cupboard width" />
            </label>
            <label>
              Opening height (mm)
              <input
                type="number"
                value={layoutDoor.openingHeight}
                readOnly={doorOpeningAuto}
                title={doorOpeningAuto ? (hasActiveDrawers ? 'Carcass height minus active drawer rows' : 'Full carcass height') : 'Split between door rows — scales with cupboard height'}
                onChange={(e) => updateDoor(door.id, { openingHeight: Number(e.target.value) })}
              />
            </label>
            <label>
              Material
              <MaterialSelect
                value={door.materialId}
                materials={materials}
                onChange={(v) => updateDoor(door.id, { materialId: v, edgingMaterialId: defaultEdgingForMaterial(v) })}
              />
            </label>
            <label>
              Edging pattern
              <select value={door.edgingPattern} onChange={(e) => updateDoor(door.id, { edgingPattern: e.target.value as EdgingPattern })}>
                {Object.entries(EDGING_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Edging type
              <select value={door.edgingMaterialId} onChange={(e) => updateDoor(door.id, { edgingMaterialId: e.target.value })}>
                {edgingMaterials.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.thickness} mm)</option>
                ))}
              </select>
            </label>
            <label className="runner-select-label">
              Hinge
              <select
                className="runner-select"
                value={door.hinge?.type === 'preset' ? door.hinge.presetId : 'custom'}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    updateDoor(door.id, { hinge: { type: 'custom', customUnitPrice: 5 } });
                  } else {
                    updateDoor(door.id, { hinge: { type: 'preset', presetId: e.target.value } });
                  }
                }}
              >
                {getHingeGroups().map((group) => (
                  <optgroup key={group.category} label={group.label}>
                    {group.hinges.map((h) => (
                      <option key={h.id} value={h.id} disabled={h.outOfStockOnline}>
                        {h.shortName}{h.outOfStockOnline ? ' (out of stock online)' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="custom">Custom hinge (manual price)</option>
              </select>
              {door.hinge?.type === 'preset' && (() => {
                const sel = getHingeById(door.hinge.presetId);
                if (!sel) return null;
                return (
                  <span className="field-hint">
                    {sel.name}
                    {sel.url && (
                      <>
                        {' · '}
                        <a href={sel.url} target="_blank" rel="noreferrer">Gelmar</a>
                      </>
                    )}
                  </span>
                );
              })()}
            </label>
          </div>
          <h4 className="subsection-title">Door gaps (mm)</h4>
          <div className="form-grid form-grid-5 door-gaps-grid">
            <label>
              Left
              <input type="number" min={0} step={0.5} value={resolveDoorGaps(door).left} onChange={(e) => updateDoorGap(door.id, 'left', Number(e.target.value))} />
            </label>
            <label>
              Right
              <input type="number" min={0} step={0.5} value={resolveDoorGaps(door).right} onChange={(e) => updateDoorGap(door.id, 'right', Number(e.target.value))} />
            </label>
            <label>
              Top
              <input type="number" min={0} step={0.5} value={resolveDoorGaps(door).top} onChange={(e) => updateDoorGap(door.id, 'top', Number(e.target.value))} />
            </label>
            <label>
              Bottom
              <input type="number" min={0} step={0.5} value={resolveDoorGaps(door).bottom} onChange={(e) => updateDoorGap(door.id, 'bottom', Number(e.target.value))} />
            </label>
            {door.qty > 1 && (
              <label>
                Between doors
                <input type="number" min={0} step={0.5} value={resolveDoorGaps(door).between} onChange={(e) => updateDoorGap(door.id, 'between', Number(e.target.value))} />
              </label>
            )}
          </div>
          <p className="hint">{doorSizeSummary(layoutDoor, { settings, edgingMaterials, materials })}</p>
        </div>
        );
      })}
      <button type="button" className="btn btn-secondary btn-sm" onClick={addDoor}>+ Add doors</button>
      </CollapsibleSection>

      <CollapsibleSection title="Drawers" variant="nested">
      <p className="hint">
        Drawers stack <strong>vertically</strong> on the front — one full-width front per row. Use <strong>+ Add drawers</strong> for another row.
        <strong> Qty per cupboard</strong> = how many matching drawers on that row (e.g. 4 = four same height). Different heights = separate rows with qty 1 each.
      </p>
      <p className="hint">
        Cut list mode: <strong>{CUT_SIZE_MODE_LABELS[settings.cutSizeMode ?? 'final']}</strong>
        {(settings.cutSizeMode ?? 'final') === 'net'
          ? ' — drawer front finished size = box + overhang; cut list board size is smaller by edging thickness.'
          : ' — drawer front cut list = finished size after edge banding.'}
      </p>
      {unit.drawers.length === 0 && (
        <p className="hint">
          No drawers on this unit. Click <strong>+ Add drawers</strong> to include drawer fronts, box parts, runners, and drawer bottoms on the cut list.
        </p>
      )}
      {unit.drawers.map((drawer, i) => {
        const layoutDrawer = layoutUnit.drawers.find((d) => d.id === drawer.id) ?? drawer;
        return (
        <div key={drawer.id} className="sub-card">
          <div className="sub-card-header">
            <strong>Drawer row {i + 1}</strong>
            <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => applyUnit({ ...unit, drawers: unit.drawers.filter((d) => d.id !== drawer.id) })}>Remove</button>
          </div>
          {drawer.qty <= 0 && (
            <p className="hint drawer-inactive-hint">
              Not on cut list — set <strong>Qty per cupboard</strong> to 1 or more to include this drawer (front, box, runners, and {drawer.bottomType === 'solid' ? 'solid melamine' : 'masonite'} bottom).
            </p>
          )}
          <div className="form-grid form-grid-4">
            <label className={drawer.qty <= 0 ? 'qty-inactive' : ''}>
              Qty per cupboard
              <input type="number" min={0} value={drawer.qty} onChange={(e) => setDrawerQty(drawer.id, Number(e.target.value))} />
            </label>
            <label>
              Opening width (mm)
              <input type="number" className="readonly" value={layoutDrawer.openingWidth} readOnly title="Matches cupboard width" />
            </label>
            <label>
              Opening height (mm)
              <input
                type="number"
                className={isActiveDrawer(drawer) ? 'readonly' : ''}
                min={minDrawerOpeningHeight(drawer, unit.doors.length > 0)}
                max={unit.doors.length > 0 ? maxDrawerOpeningHeight(unit, drawer.id) : unit.height}
                value={layoutDrawer.openingHeight}
                readOnly={isActiveDrawer(drawer)}
                title={
                  isActiveDrawer(drawer)
                    ? 'Auto: top gap + front (box + overhang) + bottom gap + gap to door'
                    : 'Inactive — set qty to 0; does not affect door'
                }
                onChange={(e) => setDrawerOpeningHeight(drawer.id, Number(e.target.value))}
              />
            </label>
            <label>Box height (mm)<input type="number" min={1} value={drawer.boxHeight} onChange={(e) => updateDrawer(drawer.id, { boxHeight: Number(e.target.value) })} /></label>
            <label>
              Front over box (mm)
              <input
                type="number"
                min={0}
                step={0.5}
                value={resolveFrontOverhang(drawer)}
                title="Finished drawer front height = box height + this amount"
                onChange={(e) => updateDrawer(drawer.id, { frontOverhangMm: Math.max(0, Number(e.target.value)) })}
              />
            </label>
            <label>
              Bottom backing
              <select value={drawer.bottomType} onChange={(e) => updateDrawer(drawer.id, { bottomType: e.target.value as DrawerConfig['bottomType'] })}>
                <option value="masonite">Masonite</option>
                <option value="solid">Solid melamine</option>
              </select>
            </label>
            <label>
              Drawer box material (carcass)
              <MaterialSelect
                value={resolveDrawerBoxMaterialId(drawer)}
                materials={materials}
                onChange={(v) => updateDrawer(drawer.id, {
                  boxMaterialId: v,
                  boxEdgingMaterialId: defaultEdgingForMaterial(v),
                })}
              />
            </label>
            <label>
              Box edging type
              <select
                value={drawer.boxEdgingMaterialId ?? defaultEdgingForMaterial(resolveDrawerBoxMaterialId(drawer))}
                onChange={(e) => updateDrawer(drawer.id, { boxEdgingMaterialId: e.target.value })}
              >
                {edgingMaterials.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.thickness} mm)</option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">
            Box front/back ({EDGING_LABELS[DRAWER_BOX_FRONT_BACK_EDGING]}):{' '}
            {drawerBoxFrontBackWidthNote(unit.width, settings.thickness, drawer.sideClearance ?? getRunnerClearances(drawer.runner).sideClearance)}
          </p>
          <p className="hint">
            Box sides ({EDGING_LABELS[DRAWER_BOX_SIDE_EDGING]}):{' '}
            {drawerBoxSideDepthNote(unit.depth, drawer.frontClearance ?? 20, drawer.backClearance ?? 5)} × box height
          </p>
          <div className="form-grid form-grid-4">
            <label>
              Drawer front material
              <MaterialSelect
                value={resolveDrawerFrontMaterialId(drawer)}
                materials={materials}
                onChange={(v) => updateDrawer(drawer.id, {
                  frontMaterialId: v,
                  frontEdgingMaterialId: defaultEdgingForMaterial(v),
                })}
              />
            </label>
            <label>
              Front edging pattern
              <select value={drawer.frontEdgingPattern} onChange={(e) => updateDrawer(drawer.id, { frontEdgingPattern: e.target.value as EdgingPattern })}>
                {Object.entries(EDGING_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Front edging type
              <select value={drawer.frontEdgingMaterialId} onChange={(e) => updateDrawer(drawer.id, { frontEdgingMaterialId: e.target.value })}>
                {edgingMaterials.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.thickness} mm)</option>
                ))}
              </select>
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
                    const entry = getRunnerById(e.target.value);
                    updateDrawer(drawer.id, {
                      runner: { type: 'preset', presetId: e.target.value },
                      sideClearance: entry?.sideClearance ?? drawer.sideClearance,
                    });
                  }
                }}
              >
                {getRunnerGroups().map((group) => (
                  <optgroup key={group.category} label={group.label}>
                    {group.runners.map((p) => (
                      <option key={p.id} value={p.id}>{p.shortName}</option>
                    ))}
                  </optgroup>
                ))}
                <option value="custom">Custom clearances</option>
              </select>
              {drawer.runner.type === 'preset' && (() => {
                const sel = getRunnerById(drawer.runner.presetId);
                if (!sel?.lengthMm) return null;
                const minDepth = sel.lengthMm + 26;
                const tooShort = unit.depth < minDepth;
                return (
                  <span className={`hint-inline${tooShort ? ' warn' : ''}`}>
                    {tooShort
                      ? `Warning: ${sel.lengthMm} mm runner may be short for ${unit.depth} mm cupboard depth (need ~${minDepth} mm+).`
                      : `${sel.lengthMm} mm runner · SKU ${sel.sku ?? '—'} · suggested side clearance ${sel.sideClearance} mm`}
                  </span>
                );
              })()}
            </label>
            {drawer.runner.type === 'custom' && (
              <label>
                Depth deduction (mm)
                <input
                  type="number"
                  value={drawer.runner.customDepthDeduction ?? 25}
                  onChange={(e) => updateDrawer(drawer.id, { runner: { ...drawer.runner, customDepthDeduction: Number(e.target.value) } })}
                />
              </label>
            )}
          </div>
          <h4 className="subsection-title">Drawer front gaps (mm)</h4>
          <div className="form-grid form-grid-5 door-gaps-grid">
            <label>
              Left
              <input type="number" min={0} step={0.5} value={resolveDrawerGaps(drawer).left} onChange={(e) => updateDrawerGap(drawer.id, 'left', Number(e.target.value))} />
            </label>
            <label>
              Right
              <input type="number" min={0} step={0.5} value={resolveDrawerGaps(drawer).right} onChange={(e) => updateDrawerGap(drawer.id, 'right', Number(e.target.value))} />
            </label>
            <label>
              Top
              <input type="number" min={0} step={0.5} value={resolveDrawerGaps(drawer).top} onChange={(e) => updateDrawerGap(drawer.id, 'top', Number(e.target.value))} />
            </label>
            <label>
              Bottom
              <input type="number" min={0} step={0.5} value={resolveDrawerGaps(drawer).bottom} onChange={(e) => updateDrawerGap(drawer.id, 'bottom', Number(e.target.value))} />
            </label>
            {resolveFrontQty(drawer) > 1 && (
              <label>
                Between fronts
                <input type="number" min={0} step={0.5} value={resolveDrawerGaps(drawer).between} onChange={(e) => updateDrawerGap(drawer.id, 'between', Number(e.target.value))} />
              </label>
            )}
            {unit.doors.length > 0 && (
              <label>
                Gap to door
                <input type="number" min={0} step={0.5} value={resolveGapToDoor(drawer)} onChange={(e) => updateDrawer(drawer.id, { gapToDoorMm: Math.max(0, Number(e.target.value)) })} />
              </label>
            )}
          </div>
          <p className="hint">
            {isActiveDrawer(drawer) ? (
              <>
                Front panel = box {drawer.boxHeight} + {resolveFrontOverhang(drawer)} mm = {drawer.boxHeight + resolveFrontOverhang(drawer)} mm.
                Opening row = top + front + bottom gaps{unit.doors.length > 0 ? ` + ${resolveGapToDoor(drawer)} mm to door` : ''} = {layoutDrawer.openingHeight} mm.
              </>
            ) : (
              <>Qty 0 — drawer not on cut list. Door uses full carcass height ({unit.height} mm opening).</>
            )}
          </p>
          <p className="hint">{drawerSizeSummary(layoutDrawer, { settings, edgingMaterials, materials }, unit.doors.length > 0)}</p>
          <h4 className="subsection-title">Drawer box clearances</h4>
          <p className="hint">Side clearance = gap each side for the runners. Front/back = gap behind the drawer front and at the rear of the box.</p>
          <div className="form-grid form-grid-3 drawer-clearances">
            <label>
              Side clearance (mm)
              <input
                type="number"
                min={0}
                step={0.1}
                value={drawer.sideClearance ?? getRunnerClearances(drawer.runner).sideClearance}
                onChange={(e) => {
                  const sideClearance = Number(e.target.value);
                  updateDrawer(drawer.id, {
                    sideClearance,
                    runner:
                      drawer.runner.type === 'custom'
                        ? { ...drawer.runner, customSideClearance: sideClearance }
                        : drawer.runner,
                  });
                }}
              />
            </label>
            <label>Front clearance (mm)<input type="number" min={0} value={drawer.frontClearance} onChange={(e) => updateDrawer(drawer.id, { frontClearance: Number(e.target.value) })} /></label>
            <label>Back clearance (mm)<input type="number" min={0} value={drawer.backClearance} onChange={(e) => updateDrawer(drawer.id, { backClearance: Number(e.target.value) })} /></label>
          </div>
        </div>
        );
      })}
      <button type="button" className="btn btn-secondary btn-sm" onClick={addDrawer}>+ Add drawers</button>
      </CollapsibleSection>

      {presets.length > 0 && (
        <p className="hint" style={{ marginTop: '1rem' }}>
          {presets.length} preset(s) saved. Manage via &quot;Add from preset&quot; above the unit list.
        </p>
      )}
      </details>
    </section>
  );
}

export function PresetPicker({ onSelect }: { onSelect: (presetId: string) => void }) {
  const [presets, setPresets] = useState(loadPresets);
  if (presets.length === 0) return null;

  return (
    <div className="preset-picker">
      <select defaultValue="" onChange={(e) => { if (e.target.value) onSelect(e.target.value); e.target.value = ''; }}>
        <option value="">Add from preset…</option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          const id = presets[0]?.id;
          const name = presets.find((p) => p.id === id)?.name;
          if (id && confirm(`Delete preset "${name}"?`)) {
            deletePreset(id);
            setPresets(loadPresets());
          }
        }}
        title="Delete first preset — use job editor save for more control"
      >
        Manage
      </button>
    </div>
  );
}

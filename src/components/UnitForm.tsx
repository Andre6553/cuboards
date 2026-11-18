import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { CupboardViewer } from './CupboardViewer';
import { defaultPlinth, BACKING_LABELS, COUNTERTOP_LABELS, CUT_SIZE_MODE_LABELS, EDGING_LABELS, DEFAULT_HINGE_PRESET_ID, isFloorCorner, isFloorUnit, isKitchenBase, isSpiceCupboard, isTallFloor, isWallCorner, KICKPLATE_COVERAGE_LABELS, KICKPLATE_EDGING_CHECKBOXES, KICKPLATE_TYPE_LABELS, MOUNT_TYPE_LABELS, mountTypesForUnitType, normalizeMountType, plinthHasKickplate, showsKickplate, UNIT_TYPE_LABELS, usesWallStyleCarcass } from '../lib/constants';
import { resolveJobMaterialDefaults } from '../lib/jobMaterialDefaults';
import { calcSpiceCupboardSizes, defaultSpiceCupboardConfig, resolveSpiceFrontHeightMm } from '../lib/spiceCupboardRules';
import { useWarningChime } from '../lib/useWarningChime';
import {
  applyFloorCornerDefaults,
  calcFloorCornerSizes,
  FLOOR_CORNER_DEFAULT_HEIGHT_MM,
  FLOOR_CORNER_FILLER_EDGING,
  FLOOR_CORNER_SIDE_EDGING,
  floorCornerDoorGaps,
  syncFloorCornerDoors,
} from '../lib/floorCornerRules';
import {
  applyWallCornerDefaults,
  calcWallCornerSizes,
  WALL_CORNER_DEFAULT_HEIGHT_MM,
  WALL_CORNER_FILLER_EDGING,
  WALL_CORNER_SIDE_EDGING,
  resolveWallCornerFiller1WidthMm,
  syncWallCornerDoors,
  wallCornerDoorGaps,
} from '../lib/wallCornerRules';
import {
  getHingeByIdForJob,
  getHingeGroupsForJob,
  getRunnerByIdForJob,
  getRunnerClearancesForJob,
  getRunnerGroupsForJob,
  usesGelmarCatalog,
} from '../lib/hardwarePricing';
import {
  doorPanelHeight,
  doorSizeSummary,
  DEFAULT_DOOR_GAPS,
  HINGE_HOLE_OPTIONS,
  hingesPerDoorLeafForDoor,
  resolveDoorGaps,
  seedCustomDoorHeights,
  usesCustomDoorSizes,
} from '../lib/doorRules';
import {
  drawerFrontHeight,
  drawerFrontWidth,
  drawerSizeSummary,
  DEFAULT_DRAWER_GAPS,
  DEFAULT_GAP_TO_DOOR_MM,
  drawerFrontVsBoxWarning,
  frontStackOverflowWarning,
  isActiveDrawer,
  activeDrawers,
  resolveDrawerBoxMaterialId,
  resolveDrawerFrontMaterialId,
  resolveDrawerGaps,
  resolveFrontQty,
  resolveGapToDoor,
  seedCustomFrontHeights,
  syncDrawerOpeningFromFront,
  usesCustomDrawerSizes,
} from '../lib/drawerRules';
import { drawerBoxFrontBackWidthNote, drawerBoxSideDepthNote, DRAWER_BOX_FRONT_BACK_EDGING, DRAWER_BOX_SIDE_EDGING } from '../lib/drawerBoxRules';
import { defaultDrawerOpeningHeight, resolveFrontLayout, syncFrontLayoutToUnit, totalDrawerOpeningHeight, totalDoorOpeningHeight } from '../lib/frontLayout';
import {
  allowsWallStyleNoFiller,
  isNoFillerMaterialId,
  NO_FILLER_MATERIAL_ID,
  resolveBedroomWallSideFiller,
  resolveBedroomWallSideFillerEdging,
  resolveBedroomWallTopFiller,
  resolveBedroomWallTopFillerEdging,
  resolveFillerMaterial,
  shouldAutoSelectNoFiller,
} from '../lib/carcassRules';
import { FillerEdgingCheckboxes } from './FillerEdgingCheckboxes';
import { defaultBedroomWallExtra } from '../lib/extrasRules';
import { usesBedroomExtrasForm, usesCustomExtrasForm } from '../lib/customExtrasRules';
import { ExtraCustomPartsForm } from './ExtraCustomPartsForm';
import { ExtraInnerForm } from './ExtraInnerForm';
import { unitAccentColor } from '../lib/unitAccentColor';
import {
  cornerBlockUsageDetail,
  cornerBlocksPerCupboard,
  resolveLeftSideVisible,
  resolveRightSideVisible,
} from '../lib/cornerBlockRules';
import {
  defaultVisibleBackPanel,
  resolveVisibleBackPanelEdging,
  resolveVisibleBackPanelMaterialId,
} from '../lib/visibleBackPanel';
import {
  boardSheetCrossMm,
  maxKickplatePieceRunMm,
  kickplateRunLengthMm,
  maxKickplateFrontRunMm,
  maxKickplateSideRunMm,
  resolveKickplateFrontRunMm,
  resolveKickplateSideRunMm,
} from '../lib/kickplateRules';
import {
  applyKickplateEdgingToggle,
  isKickplateEdgingChecked,
  kickplateEdgingSummary,
  kickplateHasNoEdging,
  KICKPLATE_EDGING_NONE_VALUE,
  resolveKickplateEdgingCounts,
  type KickplateEdgingToggle,
} from '../lib/kickplateEdging';
import { deletePreset, loadPresets, saveUnitAsPreset } from '../lib/presets';
import { CollapsibleSection } from './CollapsibleSection';
import { NumberInput } from './NumberInput';
import type { DoorConfig, DoorGaps, DrawerConfig, DrawerGaps, EdgingMaterial, EdgingPattern, Job, Material, Unit } from '../types';

/** Flip to `true` to show the carcass graphic again — component kept, only hidden. */
const SHOW_CARCASS_PREVIEW = true;

interface Props {
  job: Job;
  unit: Unit;
  materials: Material[];
  edgingMaterials: EdgingMaterial[];
  settings: Job['settings'];
  /** Bumped by parent to collapse unit settings (e.g. leave Units tab or Collapse all). */
  unitsCollapseGeneration: number;
  onChange: (unit: Unit) => void;
  onRemove: () => void;
}

function MaterialSelect({
  value,
  materials,
  onChange,
  disabled,
  extraOptions,
}: {
  value: string;
  materials: Material[];
  onChange: (id: string) => void;
  disabled?: boolean;
  /** Options shown above board materials (e.g. No Filler). */
  extraOptions?: { id: string; label: string }[];
}) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {extraOptions?.map((opt) => (
        <option key={opt.id} value={opt.id}>{opt.label}</option>
      ))}
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

export function UnitForm({
  job,
  unit,
  materials,
  edgingMaterials,
  settings,
  unitsCollapseGeneration,
  onChange,
  onRemove,
}: Props) {
  const [presets, setPresets] = useState(loadPresets);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setSettingsOpen(false);
  }, [unitsCollapseGeneration]);

  /**
   * When a unit *becomes* wall/tall-floor + melamine (backing change or mount/type change),
   * jump Top filler material to No Filler. Staying eligible while the user picks a board
   * must not force No Filler again.
   */
  const wasNoFillerEligibleRef = useRef(shouldAutoSelectNoFiller(unit));
  const noFillerUnitIdRef = useRef(unit.id);
  useEffect(() => {
    if (noFillerUnitIdRef.current !== unit.id) {
      noFillerUnitIdRef.current = unit.id;
      wasNoFillerEligibleRef.current = shouldAutoSelectNoFiller(unit);
      return;
    }
    const eligible = shouldAutoSelectNoFiller(unit);
    const becameEligible = eligible && !wasNoFillerEligibleRef.current;
    wasNoFillerEligibleRef.current = eligible;
    if (!becameEligible) return;
    if (isNoFillerMaterialId(unit.carcass.fillerMaterialId)) return;
    onChange({
      ...unit,
      carcass: {
        ...unit.carcass,
        fillerMaterialId: NO_FILLER_MATERIAL_ID,
      },
    });
  }, [unit, onChange]);

  const layoutUnit = resolveFrontLayout(unit);
  const activeDrawerRows = activeDrawers(layoutUnit.drawers);
  const hasActiveDrawers = activeDrawerRows.length > 0;
  const customDrawersOn = usesCustomDrawerSizes(unit);
  const unitWarningSignature = [
    frontStackOverflowWarning(layoutUnit),
    unit.doors.length > 0 && !usesCustomDoorSizes(unit)
      ? 'This unit already has a door. Turn on Customize door sizes'
      : null,
    ...layoutUnit.drawers.map((d) =>
      drawerFrontVsBoxWarning(d, unit.height, layoutUnit.drawers, customDrawersOn),
    ),
  ]
    .filter((w): w is string => typeof w === 'string' && w.length > 0)
    .join('\n');
  useWarningChime(unitWarningSignature);

  const applyUnit = (next: Unit, opts?: { changedDrawerId?: string }) =>
    onChange(syncFrontLayoutToUnit(next, opts));

  useEffect(() => {
    if (unit.type !== 'bedroom' || unit.plinth) return;
    onChange({
      ...unit,
      plinth: defaultPlinth({ settings, materials }, unit.carcass.leftMaterialId),
    });
  }, [unit, onChange, settings, materials]);

  const set = <K extends keyof Unit>(field: K, value: Unit[K]) => {
    if (field === 'width' || field === 'height' || field === 'depth') {
      let next = { ...unit, [field]: value };
      if (field === 'height' && isSpiceCupboard(next) && next.spice) {
        next.spice = {
          ...next.spice,
          frontHeightMm: resolveSpiceFrontHeightMm(next.spice, next.height),
        };
      }
      if (isFloorCorner(next)) {
        next = syncFloorCornerDoors(next);
      }
      if (isWallCorner(next)) {
        next = syncWallCornerDoors(next);
      }
      if (next.plinth) {
        const w = next.width;
        const d = next.depth;
        const maxFront = maxKickplateFrontRunMm(w, settings);
        const maxSide = maxKickplateSideRunMm(d, settings);
        let plinth = next.plinth;
        if (plinth.kickplateFrontRunMm != null && plinth.kickplateFrontRunMm > maxFront) {
          plinth = { ...plinth, kickplateFrontRunMm: maxFront };
        }
        if (plinth.kickplateSideRunMm != null && plinth.kickplateSideRunMm > maxSide) {
          plinth = { ...plinth, kickplateSideRunMm: maxSide };
        }
        if (plinth !== next.plinth) next = { ...next, plinth };
      }
      applyUnit(next);
      return;
    }
    onChange({ ...unit, [field]: value });
  };
  const setCarcass = (field: keyof Unit['carcass'], value: Unit['carcass'][typeof field]) =>
    onChange({ ...unit, carcass: { ...unit.carcass, [field]: value } });

  const setVisibleBackPanel = (patch: Partial<NonNullable<Unit['carcass']['visibleBackPanel']>>) => {
    const prev = unit.carcass.visibleBackPanel ?? defaultVisibleBackPanel(unit);
    onChange({
      ...unit,
      carcass: { ...unit.carcass, visibleBackPanel: { ...prev, ...patch } },
    });
  };

  const setPlinth = (field: keyof NonNullable<Unit['plinth']>, value: NonNullable<Unit['plinth']>[typeof field]) => {
    const plinth = unit.plinth ?? defaultPlinth({ settings, materials }, unit.carcass.leftMaterialId);
    onChange({ ...unit, plinth: { ...plinth, [field]: value } });
  };

  const setKickplateEdgingCheckbox = (key: KickplateEdgingToggle, checked: boolean) => {
    const plinth = unit.plinth ?? defaultPlinth({ settings, materials }, unit.carcass.leftMaterialId);
    const next = applyKickplateEdgingToggle(resolveKickplateEdgingCounts(plinth), key, checked);
    onChange({
      ...unit,
      plinth: {
        ...plinth,
        kickplateEdgingLongCount: next.long,
        kickplateEdgingShortCount: next.short,
      },
    });
  };

  const handleTypeChange = (type: Unit['type']) => {
    const mountType = normalizeMountType(type, unit.carcass.mountType);
    let carcass = { ...unit.carcass, mountType };
    const nextProbe = { type, carcass };
    if (
      isNoFillerMaterialId(carcass.fillerMaterialId) &&
      !allowsWallStyleNoFiller(nextProbe)
    ) {
      const restored = carcass.leftMaterialId || carcass.rightMaterialId || materials[0]?.id || '';
      carcass = {
        ...carcass,
        fillerMaterialId: restored,
        fillerEdgingMaterialId:
          materials.find((m) => m.id === restored)?.edgingMaterialId ?? edgingMaterials[0]?.id ?? '',
      };
    }
    if (isKitchenBase(type) || type === 'bedroom') {
      onChange({
        ...unit,
        type,
        carcass,
        plinth: unit.plinth ?? defaultPlinth({ settings, materials }, unit.carcass.leftMaterialId),
      });
    } else {
      const { plinth: _, ...rest } = unit;
      onChange({
        ...rest,
        type,
        carcass,
      });
    }
  };

  const handleMountChange = (mountType: Unit['carcass']['mountType']) => {
    const nextMount = normalizeMountType(unit.type, mountType);
    let next: Unit = {
      ...unit,
      carcass: {
        ...unit.carcass,
        mountType: nextMount,
        shelfQty:
          nextMount === 'spice'
            ? 0
            : nextMount === 'floor_corner'
              ? 1
              : nextMount === 'wall_corner'
                ? 2
                : unit.carcass.shelfQty,
      },
      spice: nextMount === 'spice' ? (unit.spice ?? defaultSpiceCupboardConfig(unit.height)) : unit.spice,
    };
    if (nextMount === 'floor_corner') {
      next = applyFloorCornerDefaults(
        {
          ...next,
          height: next.height || FLOOR_CORNER_DEFAULT_HEIGHT_MM,
        },
        job,
      );
    }
    if (nextMount === 'wall_corner') {
      next = applyWallCornerDefaults(
        {
          ...next,
          height: next.height || WALL_CORNER_DEFAULT_HEIGHT_MM,
        },
        job,
      );
    }
    if (((isFloorUnit(next) && isKitchenBase(unit.type)) || unit.type === 'bedroom') && !next.plinth) {
      next.plinth = defaultPlinth({ settings, materials }, unit.carcass.leftMaterialId);
    }
    // No Filler only applies to wall-style + melamine; restore a board when leaving that mode.
    if (
      isNoFillerMaterialId(next.carcass.fillerMaterialId) &&
      !allowsWallStyleNoFiller(next)
    ) {
      const restored =
        next.carcass.leftMaterialId || next.carcass.rightMaterialId || materials[0]?.id || '';
      next = {
        ...next,
        carcass: {
          ...next.carcass,
          fillerMaterialId: restored,
          fillerEdgingMaterialId:
            materials.find((m) => m.id === restored)?.edgingMaterialId ?? edgingMaterials[0]?.id ?? '',
        },
      };
    }
    onChange(next);
  };

  const setSpice = (patch: Partial<NonNullable<Unit['spice']>>) => {
    const base = unit.spice ?? defaultSpiceCupboardConfig(unit.height);
    onChange({
      ...unit,
      spice: {
        ...base,
        ...patch,
        frontHeightMm: resolveSpiceFrontHeightMm(
          { ...base, ...patch },
          unit.height,
        ),
      },
    });
  };

  const mountOptions = mountTypesForUnitType(unit.type);
  const spiceMount = isSpiceCupboard(unit);
  const floorCornerMount = isFloorCorner(unit);
  const wallCornerMount = isWallCorner(unit);
  const cornerMount = floorCornerMount || wallCornerMount;
  const spiceSizes = spiceMount
    ? calcSpiceCupboardSizes(unit.width, unit.height, unit.depth, settings.thickness, unit.spice)
    : null;
  const spiceConfig = unit.spice ?? defaultSpiceCupboardConfig(unit.height);
  const floorCornerSizes = floorCornerMount ? calcFloorCornerSizes(unit) : null;
  const wallCornerSizes = wallCornerMount ? calcWallCornerSizes(unit, settings.thickness) : null;

  const isFloor = isFloorUnit(unit);
  const tallFloorMount = isTallFloor(unit);
  /** Wall-style: Top panel + 2 fillers (pure wall or kitchen tall floor). */
  const wallStyleCarcass = usesWallStyleCarcass(unit);
  /** Kitchen base on wall mount still uses countertop fillers; pure wall / tall floor use a top panel. */
  const wallTopFillers = !isFloor && isKitchenBase(unit.type);
  const showTopFillers = !cornerMount && (isFloor || wallTopFillers);
  const showCountertopType = showTopFillers && !tallFloorMount;
  const showNoFillerOption = allowsWallStyleNoFiller(unit);
  const noFillerSelected = showNoFillerOption && isNoFillerMaterialId(unit.carcass.fillerMaterialId);

  const jobMats = resolveJobMaterialDefaults({ materials, edgingMaterials, settings });
  const defaultMat = jobMats.carcassMaterialId || materials[0]?.id || '';
  const effectiveFillerId = resolveFillerMaterial(unit.carcass, materials);
  const fillerSelectValue = noFillerSelected
    ? NO_FILLER_MATERIAL_ID
    : isNoFillerMaterialId(unit.carcass.fillerMaterialId)
      ? (unit.carcass.leftMaterialId || defaultMat)
      : (unit.carcass.fillerMaterialId || effectiveFillerId);

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
    const gaps = { ...DEFAULT_DOOR_GAPS, between: settings.defaultGap };
    const doorH = Math.max(1, Math.round(unit.height - gaps.top - gaps.bottom));
    const door: DoorConfig = {
      id: crypto.randomUUID(),
      qty: 1,
      materialId: jobMats.doorMaterialId,
      edgingPattern: '2_long_2_short',
      edgingMaterialId: jobMats.doorEdgingMaterialId,
      openingWidth: unit.width,
      openingHeight: unit.height,
      gaps,
      hinge: { type: 'preset', presetId: DEFAULT_HINGE_PRESET_ID },
      ...(usesCustomDoorSizes(unit) ? { doorHeightMm: doorH } : {}),
    };
    applyUnit({ ...unit, doors: [...unit.doors, door] });
  };

  const addDrawer = () => {
    const hasDoor = unit.doors.length > 0;
    if (hasDoor && !usesCustomDoorSizes(unit)) {
      window.alert(
        'This unit already has a door. Turn on Customize door sizes (Doors section) if you want drawers sharing the front with a fixed door height. Otherwise remove the door first, or continue knowing openings will be auto-split.',
      );
    }
    const newCount = unit.drawers.length + 1;
    const equalShare = Math.round((unit.height / newCount) * 10) / 10;
    const existingDrawers = hasDoor
      ? unit.drawers
      : unit.drawers.map((d) => ({ ...d, openingHeight: equalShare }));
    const gaps = { ...DEFAULT_DRAWER_GAPS, between: settings.defaultGap };
    const drawer: DrawerConfig = {
      id: crypto.randomUUID(),
      qty: 1,
      boxMaterialId: jobMats.drawerBoxMaterialId,
      frontMaterialId: jobMats.drawerFrontMaterialId,
      bottomType: 'masonite',
      boxHeight: 120,
      frontQty: 1,
      runner: { type: 'preset', presetId: 'blum-tandem' },
      openingWidth: unit.width,
      openingHeight: hasDoor ? defaultDrawerOpeningHeight(unit) : equalShare,
      gaps,
      frontEdgingPattern: '2_long_2_short',
      frontEdgingMaterialId: jobMats.drawerFrontEdgingMaterialId,
      boxEdgingMaterialId: jobMats.drawerBoxEdgingMaterialId,
      gapToDoorMm: DEFAULT_GAP_TO_DOOR_MM,
      sideClearance: 13,
      frontClearance: 0,
      backClearance: 25,
    };
    const withNew = [...existingDrawers, drawer];
    let ready = syncDrawerOpeningFromFront(drawer, unit.doors.length > 0, unit.height, withNew);
    if (usesCustomDrawerSizes(unit)) {
      const frontH = drawerFrontHeight(ready, unit.height, [...existingDrawers, ready], false);
      ready = { ...ready, frontHeightMm: frontH > 0 ? frontH : Math.round(unit.height / Math.max(1, newCount)) };
    }
    applyUnit({ ...unit, drawers: [...existingDrawers, ready] });
  };

  const setDrawerQty = (id: string, qty: number) => {
    updateDrawer(id, { qty: Math.max(0, qty) });
  };

  const updateDoorGap = (id: string, field: keyof DoorGaps, value: number) => {
    const door = unit.doors.find((d) => d.id === id);
    if (!door) return;
    const gaps = resolveDoorGaps(door);
    const nextGaps = { ...gaps, [field]: Math.max(0, value) };
    updateDoor(id, {
      gaps: isFloorCorner(unit)
        ? floorCornerDoorGaps(nextGaps)
        : isWallCorner(unit)
          ? wallCornerDoorGaps(nextGaps)
          : nextGaps,
    });
  };

  const updateDrawerGap = (id: string, field: keyof DrawerGaps, value: number) => {
    const drawer = unit.drawers.find((d) => d.id === id);
    if (!drawer) return;
    const gaps = resolveDrawerGaps(drawer);
    updateDrawer(id, { gaps: { ...gaps, [field]: Math.max(0, value) } });
  };

  const updateDoor = (id: string, patch: Partial<DoorConfig>) => {
    let doors = unit.doors.map((d) => (d.id === id ? { ...d, ...patch } : d));
    let next = { ...unit, doors };
    if (isFloorCorner(next)) next = syncFloorCornerDoors(next);
    if (isWallCorner(next)) next = syncWallCornerDoors(next);
    applyUnit(next);
  };

  const updateDrawer = (id: string, patch: Partial<DrawerConfig>, opts?: { changedDrawerId?: string }) => {
    const drawers = unit.drawers.map((d) => (d.id === id ? { ...d, ...patch } : d));
    applyUnit({ ...unit, drawers }, opts?.changedDrawerId ? { changedDrawerId: opts.changedDrawerId } : undefined);
  };

  const isOnCutList = (unit.unitQty ?? 0) > 0;
  const stopSummaryToggle = (e: MouseEvent | PointerEvent) => e.stopPropagation();

  return (
    <section
      className={`card unit-card${isOnCutList ? '' : ' unit-inactive'}`}
      style={isOnCutList ? { borderLeftColor: unitAccentColor(unit.id) } : undefined}
    >
      <div className="unit-header-row">
        <input className="unit-name-input" value={unit.name} onChange={(e) => set('name', e.target.value)} />
        <label className="unit-qty-inline qty-highlight" onClick={stopSummaryToggle} onPointerDown={stopSummaryToggle}>
          Cupboard qty
          <NumberInput
            
            min={0}
            value={unit.unitQty}
            onChange={(n) => set('unitQty', Math.max(0, n))}
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

      <details
        className="detail-breakdown collapsible-section collapsible-subsection unit-settings-details"
        open={settingsOpen}
        onToggle={(e) => setSettingsOpen(e.currentTarget.open)}
      >
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
            <select
              value={normalizeMountType(unit.type, unit.carcass.mountType)}
              onChange={(e) => handleMountChange(e.target.value as Unit['carcass']['mountType'])}
            >
              {mountOptions.map((k) => (
                <option key={k} value={k}>{MOUNT_TYPE_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <label>
            Width (mm)
            {cornerMount ? (
              <input
                type="number"
                className="readonly"
                value={unit.width}
                readOnly
                title={floorCornerMount ? 'Floor corner — fixed panel 884 mm' : 'Wall corner — fixed panel 584 mm'}
              />
            ) : (
              <NumberInput value={unit.width} onChange={(n) => set('width', n)} />
            )}
          </label>
          <label>
            {cornerMount ? 'Side height (mm)' : 'Height (mm)'}
            <NumberInput value={unit.height} onChange={(n) => set('height', n)} />
          </label>
          <label>
            Depth (mm)
            {cornerMount ? (
              <input
                type="number"
                className="readonly"
                value={unit.depth}
                readOnly
                title={floorCornerMount ? 'Floor corner — side depth 550 mm' : 'Wall corner — side depth 300 mm'}
              />
            ) : (
              <NumberInput value={unit.depth} onChange={(n) => set('depth', n)} />
            )}
          </label>
        </div>

        {SHOW_CARCASS_PREVIEW && (
          <CupboardViewer
            unit={layoutUnit}
            thickness={settings.thickness}
            materials={materials}
            onShelfQtyChange={(qty) => setCarcass('shelfQty', qty)}
          />
        )}

      {floorCornerMount && floorCornerSizes && (
        <CollapsibleSection title="Floor corner — fixed cut sizes" variant="nested" defaultOpen>
          <p className="hint">
            Bottom / shelf / top {floorCornerSizes.panelMm}×{floorCornerSizes.panelMm} mm (no edging) · Sides{' '}
            {floorCornerSizes.sideHeightMm}×{floorCornerSizes.sideDepthMm} mm (1 long on height — changeable) · Fillers 2×{' '}
            {floorCornerSizes.fillerLengthMm}×{floorCornerSizes.fillerWidthMm} mm · Masonite 2×{' '}
            {floorCornerSizes.masoniteHeightMm}×{floorCornerSizes.masoniteWidthMm} mm · Doors{' '}
            {floorCornerSizes.doorHeightMm}×{floorCornerSizes.door1WidthMm} and {floorCornerSizes.doorHeightMm}×
            {floorCornerSizes.door2WidthMm} mm (height = side height − top − bottom gaps only).
          </p>
        </CollapsibleSection>
      )}

      {wallCornerMount && wallCornerSizes && (
        <CollapsibleSection title="Wall corner — fixed cut sizes" variant="nested" defaultOpen>
          <p className="hint">
            Bottom / 2 shelves / top {wallCornerSizes.panelMm}×{wallCornerSizes.panelMm} mm (no edging) · Sides{' '}
            {wallCornerSizes.sideHeightMm}×{wallCornerSizes.sideDepthMm} mm · Filler 1: 2×{' '}
            {wallCornerSizes.filler1LengthMm}×{wallCornerSizes.filler1WidthMm} mm (H−2T × typed width) · Filler 2: 2×{' '}
            {wallCornerSizes.filler2LengthMm}×{wallCornerSizes.filler2WidthMm} · Filler 3: 2×{' '}
            {wallCornerSizes.filler3LengthMm}×{wallCornerSizes.filler3WidthMm} · Masonite 2×{' '}
            {wallCornerSizes.masoniteHeightMm}×{wallCornerSizes.masoniteWidthMm} mm · Doors{' '}
            {wallCornerSizes.doorHeightMm}×{wallCornerSizes.door1WidthMm} and {wallCornerSizes.doorHeightMm}×
            {wallCornerSizes.door2WidthMm} mm (T/B gaps only).
          </p>
        </CollapsibleSection>
      )}

      {spiceMount && (
        <CollapsibleSection title="Spice cupboard — cut sizes" variant="nested">
          <div className="form-grid form-grid-3">
            <label>
              Spice front height (mm)
              <NumberInput
                min={1}
                max={unit.height}
                value={resolveSpiceFrontHeightMm(spiceConfig, unit.height)}
                onChange={(n) => setSpice({ frontHeightMm: n })}
                title={`Max ${unit.height} mm (carcass height)`}
              />
            </label>
            <label>
              Runner side clearance (mm)
              <NumberInput
                min={0}
                value={spiceConfig.runnerSideClearanceMm ?? 13}
                onChange={(n) => setSpice({ runnerSideClearanceMm: n })}
                title="Per side — spice front width = carcass internal − 2× clearance"
              />
            </label>
          </div>
          {spiceSizes && (
            <p className="hint">
              Front/back {spiceSizes.frontWidth} × {spiceSizes.frontHeight} mm (2 long + 1 short) · Split{' '}
              {spiceSizes.splitWidth} × {spiceSizes.splitHeight} mm · Bottom {spiceSizes.bottomDepth} ×{' '}
              {spiceSizes.bottomWidth} mm · Shelves L/R {spiceSizes.shelfDepth} × {spiceSizes.shelfWidth} mm · Fillers 2×{' '}
              {spiceSizes.fillerHeight} × {spiceSizes.fillerWidth} mm. Uses <strong>shelf material</strong> on cut list; top
              fillers same as no-shelf carcass.
            </p>
          )}
        </CollapsibleSection>
      )}

      {showsKickplate(unit) && (() => {
        const plinth = unit.plinth ?? defaultPlinth({ settings, materials }, unit.carcass.leftMaterialId);
        const kickplateActive = plinthHasKickplate(plinth);
        const kickplateWood = plinth.kickplateType === 'wood';
        const kickplateProducts = job.plasticKickplate.useGelmarCatalog === false
          ? job.plasticKickplate.customProducts ?? []
          : [];
        const selectedKickplate = kickplateProducts.find((product) => product.id === plinth.plasticKickplateProductId);
        return (
        <CollapsibleSection title="Kitchen plinth — kickplate & feet" variant="nested">
          <div className="form-grid form-grid-4">
            <label>
              Kickplate type
              <select value={plinth.kickplateType ?? 'wood'} onChange={(e) => setPlinth('kickplateType', e.target.value)}>
                {Object.entries(KICKPLATE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            {plinth.kickplateType === 'plastic' && kickplateProducts.length > 0 && (
              <label>
                Plastic kickplate product
                <select
                  value={selectedKickplate?.id ?? ''}
                  onChange={(e) => setPlinth('plasticKickplateProductId', e.target.value || undefined)}
                >
                  <option value="">Job default · {job.plasticKickplate.name}</option>
                  {kickplateProducts.map((product) => (
                    <option key={product.id} value={product.id}>{product.name || 'Unnamed product'}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Kickplate coverage
              <select
                disabled={!kickplateActive}
                value={plinth.kickplateCoverage ?? 'front'}
                onChange={(e) => setPlinth('kickplateCoverage', e.target.value)}
              >
                {Object.entries(KICKPLATE_COVERAGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            {plinth.kickplateCoverage === 'front-one-side' && (
              <label>
                Side return
                <select
                  disabled={!kickplateActive}
                  value={plinth.kickplateSide ?? 'left'}
                  onChange={(e) => setPlinth('kickplateSide', e.target.value)}
                >
                  <option value="left">Left side</option>
                  <option value="right">Right side</option>
                </select>
              </label>
            )}
            {kickplateWood && (
              <>
                <label>
                  Kickplate board material
                  <MaterialSelect
                    disabled={!kickplateActive}
                    value={plinth.kickplateMaterialId}
                    materials={materials}
                    onChange={(v) => {
                      const plinth = unit.plinth ?? defaultPlinth({ settings, materials }, unit.carcass.leftMaterialId);
                      onChange({
                        ...unit,
                        plinth: {
                          ...plinth,
                          kickplateMaterialId: v,
                          kickplateEdgingMaterialId: defaultEdgingForMaterial(v),
                        },
                      });
                    }}
                  />
                </label>
                <label>
                  Edging type
                  <select
                    disabled={!kickplateActive}
                    value={
                      kickplateHasNoEdging(plinth)
                        ? KICKPLATE_EDGING_NONE_VALUE
                        : (plinth.kickplateEdgingMaterialId ??
                            defaultEdgingForMaterial(plinth.kickplateMaterialId))
                    }
                    onChange={(e) => {
                      const currentPlinth = unit.plinth ?? defaultPlinth({ settings, materials }, unit.carcass.leftMaterialId);
                      const v = e.target.value;
                      if (v === KICKPLATE_EDGING_NONE_VALUE) {
                        onChange({
                          ...unit,
                          plinth: {
                            ...currentPlinth,
                            kickplateEdgingLongCount: 0,
                            kickplateEdgingShortCount: 0,
                          },
                        });
                        return;
                      }
                      const counts = resolveKickplateEdgingCounts(currentPlinth);
                      onChange({
                        ...unit,
                        plinth: {
                          ...currentPlinth,
                          kickplateEdgingMaterialId: v,
                          ...(counts.long === 0 && counts.short === 0
                            ? { kickplateEdgingLongCount: 1 as const, kickplateEdgingShortCount: 0 as const }
                            : {}),
                        },
                      });
                    }}
                  >
                    <option value={KICKPLATE_EDGING_NONE_VALUE}>No edging</option>
                    {edgingMaterials.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.thickness} mm)
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {kickplateWood && (
              <>
                <label>
                  Front long edge (mm)
                  <NumberInput
                    disabled={!kickplateActive}
                    min={1}
                    max={maxKickplateFrontRunMm(unit.width, settings)}
                    integer
                    value={plinth.kickplateFrontRunMm ?? unit.width}
                    title={`Total front kick run — each board piece max ${maxKickplatePieceRunMm(settings)} mm (sheet short side); longer runs split for on-site join`}
                    onChange={(n) => {
                      const currentPlinth = unit.plinth ?? defaultPlinth({ settings, materials }, unit.carcass.leftMaterialId);
                      const max = maxKickplateFrontRunMm(unit.width, settings);
                      const clamped = Math.min(Math.max(1, Math.round(n)), max);
                      onChange({
                        ...unit,
                        plinth: {
                          ...currentPlinth,
                          kickplateFrontRunMm: clamped,
                        },
                      });
                    }}
                  />
                  <span className="field-hint">
                    Total run {resolveKickplateFrontRunMm(unit.width, plinth, settings)} mm · cut list {plinth.kickplateHeight} × run (grain
                    vertical) · max {maxKickplatePieceRunMm(settings)} mm per piece ({boardSheetCrossMm(settings)} mm sheet width)
                  </span>
                </label>
                {(plinth.kickplateCoverage === 'front-one-side' || plinth.kickplateCoverage === 'front-both-sides') && (
                  <label>
                    Side return long edge (mm)
                    <NumberInput
                      disabled={!kickplateActive}
                      min={1}
                      max={maxKickplateSideRunMm(unit.depth, settings)}
                      integer
                      value={plinth.kickplateSideRunMm ?? unit.depth}
                      title={`Total side return run — max ${maxKickplatePieceRunMm(settings)} mm per board piece`}
                      onChange={(n) => {
                        const currentPlinth = unit.plinth ?? defaultPlinth({ settings, materials }, unit.carcass.leftMaterialId);
                        const max = maxKickplateSideRunMm(unit.depth, settings);
                        const clamped = Math.min(Math.max(1, Math.round(n)), max);
                        onChange({
                          ...unit,
                          plinth: {
                            ...currentPlinth,
                            kickplateSideRunMm: clamped,
                          },
                        });
                      }}
                    />
                    <span className="field-hint">
                      Total run {resolveKickplateSideRunMm(unit.depth, plinth, settings)} mm each return · {plinth.kickplateHeight} × run · max{' '}
                      {maxKickplatePieceRunMm(settings)} mm per piece
                    </span>
                  </label>
                )}
              </>
            )}
            <label>
              Kickplate height (mm)
              <NumberInput
                disabled={!kickplateActive}
                min={80}
                max={200}
                value={plinth.kickplateHeight}
                onChange={(n) => setPlinth('kickplateHeight', n)}
              />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={plinth.feetRequired !== false} onChange={(e) => setPlinth('feetRequired', e.target.checked)} />
              Cabinet adjustable feet (Gelmar H98–122 mm)
            </label>
            {plinth.feetRequired !== false && (
              <label>
                Adjustable feet per cupboard
                <NumberInput  min={2} max={8} value={plinth.feetPerUnit} onChange={(n) => setPlinth('feetPerUnit', n)} />
              </label>
            )}
          </div>
          {kickplateWood && kickplateActive && (() => {
            const edgingCounts = resolveKickplateEdgingCounts(plinth);
            return (
            <div className="kickplate-edging-patterns">
              <span className="field-label">Edging (Long = along kick run · short = along height)</span>
              <div className="checkbox-row">
                {KICKPLATE_EDGING_CHECKBOXES.map(({ key, label }) => (
                  <label key={key} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isKickplateEdgingChecked(edgingCounts, key)}
                      onChange={(e) => setKickplateEdgingCheckbox(key, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            );
          })()}
          <p className="hint">
            {!kickplateActive ? (
              <>No kickplate on this unit — nothing added to the cut list for kickplate. Plastic feet below still apply when ticked.</>
            ) : kickplateWood ? (
              <>
                Wood kickplate: grain along kick height on grain boards ·{' '}
                {kickplateEdgingSummary(resolveKickplateEdgingCounts(plinth))}
                {(() => {
                  const c = resolveKickplateEdgingCounts(plinth);
                  if (c.long + c.short <= 0) return null;
                  return (
                    <>
                      {' '}
                      (
                      {edgingMaterials.find(
                        (e) =>
                          e.id ===
                          (plinth.kickplateEdgingMaterialId ??
                            defaultEdgingForMaterial(plinth.kickplateMaterialId)),
                      )?.name ?? '—'}
                      )
                    </>
                  );
                })()}
                .
              </>
            ) : (
              <>Plastic kickplate: {kickplateRunLengthMm(unit.width, unit.depth, plinth.kickplateCoverage ?? 'front', plinth, settings)} mm run per cupboard
                {unit.unitQty > 1 ? ` × ${unit.unitQty} = ${(kickplateRunLengthMm(unit.width, unit.depth, plinth.kickplateCoverage ?? 'front', plinth, settings) * unit.unitQty / 1000).toFixed(2)} m total` : ''}.
                Set strip size &amp; price under Materials.</>
            )}
          </p>
        </CollapsibleSection>
        );
      })()}

      <CollapsibleSection title="Carcass" variant="nested">
      {(tallFloorMount || !isFloor) && (
        <p className="hint">
          {wallStyleCarcass ? (
            <>
              {tallFloorMount ? 'Tall Floor' : 'Wall unit'}: bottom + top panel (
              {unit.depth} × {unit.width - 2 * settings.thickness} mm)
              {noFillerSelected
                ? '; no top fillers (No Filler selected).'
                : '; plus 2 top fillers (front + back, filler width × internal W).'}
              {tallFloorMount ? ' Includes kitchen plinth (kickplate & feet).' : ' No kickplate or feet.'}
            </>
          ) : wallTopFillers ? (
            <>
              Kitchen base on wall:{' '}
              {unit.carcass.countertopType === 'wooden'
                ? '3 top fillers (front, back, centre)'
                : '2 top fillers (front + back)'}
              , same as a floor unit. No kickplate or feet.
            </>
          ) : (
            <>
              Wall mount: same carcass as a wall unit. Tick side fillers and top fillers below if you want them. No
              kickplate or feet.
            </>
          )}
        </p>
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
          {cornerMount && (
            <label>
              Left side edging pattern
              <select
                value={
                  unit.carcass.leftEdgingPattern ??
                  (floorCornerMount ? FLOOR_CORNER_SIDE_EDGING : WALL_CORNER_SIDE_EDGING)
                }
                onChange={(e) => setCarcass('leftEdgingPattern', e.target.value as EdgingPattern)}
              >
                {Object.entries(EDGING_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Left side edging type
            <span className="hint inline-hint">{cornerMount ? 'Tape for the long (height) edge' : '1 long edge (front)'}</span>
            <EdgingTypeSelect
              value={unit.carcass.leftEdgingMaterialId}
              fallbackMaterialId={unit.carcass.leftMaterialId}
              materials={materials}
              edgingMaterials={edgingMaterials}
              onChange={(v) => setCarcass('leftEdgingMaterialId', v)}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={resolveLeftSideVisible(unit.carcass, materials)}
              onChange={(e) => setCarcass('leftVisible', e.target.checked)}
            />
            Left side visible (corner blocks)
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
          {cornerMount && (
            <label>
              Right side edging pattern
              <select
                value={
                  unit.carcass.rightEdgingPattern ??
                  (floorCornerMount ? FLOOR_CORNER_SIDE_EDGING : WALL_CORNER_SIDE_EDGING)
                }
                onChange={(e) => setCarcass('rightEdgingPattern', e.target.value as EdgingPattern)}
              >
                {Object.entries(EDGING_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Right side edging type
            <span className="hint inline-hint">{cornerMount ? 'Tape for the long (height) edge' : '1 long edge (front)'}</span>
            <EdgingTypeSelect
              value={unit.carcass.rightEdgingMaterialId}
              fallbackMaterialId={unit.carcass.rightMaterialId}
              materials={materials}
              edgingMaterials={edgingMaterials}
              onChange={(v) => setCarcass('rightEdgingMaterialId', v)}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={resolveRightSideVisible(unit.carcass, materials)}
              onChange={(e) => setCarcass('rightVisible', e.target.checked)}
            />
            Right side visible (corner blocks)
          </label>
        </div>
      </div>
      <p className="hint">
        Corner blocks: {cornerBlocksPerCupboard(unit, materials)}/cupboard — {cornerBlockUsageDetail(unit, materials)}.
        {' '}No visible sides → none (unless solid melamine backing → +4). One visible → 2/shelf + 1/filler. Both → 4/shelf + 2/filler. Solid backing adds +4.
      </p>
      <div className={`carcass-sides${cornerMount || wallStyleCarcass ? '' : ' carcass-sides--bottom-only'}`}>
        <div className="side-column">
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
                  ...((cornerMount || wallStyleCarcass) && !unit.carcass.topMaterialId
                    ? { topMaterialId: v, topEdgingMaterialId: defaultEdgingForMaterial(v) }
                    : {}),
                },
              })}
            />
            {cornerMount && <span className="hint-inline">Fixed panel · no edging</span>}
          </label>
          {!cornerMount && (
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
          )}
        </div>
        {(cornerMount || wallStyleCarcass) && (
          <div className="side-column">
            <label>
              Top material
              <MaterialSelect
                value={unit.carcass.topMaterialId || unit.carcass.bottomMaterialId}
                materials={materials}
                onChange={(v) =>
                  onChange({
                    ...unit,
                    carcass: {
                      ...unit.carcass,
                      topMaterialId: v,
                      topEdgingMaterialId:
                        unit.carcass.topEdgingMaterialId || defaultEdgingForMaterial(v),
                    },
                  })
                }
              />
              {cornerMount && <span className="hint-inline">Fixed panel · no edging</span>}
            </label>
            {wallStyleCarcass && (
              <label>
                Top edging type
                <EdgingTypeSelect
                  value={unit.carcass.topEdgingMaterialId}
                  fallbackMaterialId={unit.carcass.topMaterialId || unit.carcass.bottomMaterialId}
                  materials={materials}
                  edgingMaterials={edgingMaterials}
                  onChange={(v) => setCarcass('topEdgingMaterialId', v)}
                />
              </label>
            )}
          </div>
        )}
      </div>
      <div className="form-grid form-grid-3">
        {cornerMount && (
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
            <span className="hint-inline">
              {floorCornerMount ? '884×884 · no edging' : '2× 584×584 · no edging'}
            </span>
          </label>
        )}
        {showCountertopType && (
          <label>
            Countertop type
            <select value={unit.carcass.countertopType ?? 'granite'} onChange={(e) => setCarcass('countertopType', e.target.value as Unit['carcass']['countertopType'])}>
              {Object.entries(COUNTERTOP_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        )}
        {cornerMount ? (
          <p className="hint">
            Backing is fixed masonite — 2 ×{' '}
            {(floorCornerSizes ?? wallCornerSizes)?.masoniteHeightMm ?? unit.height} ×{' '}
            {(floorCornerSizes ?? wallCornerSizes)?.masoniteWidthMm ?? (floorCornerMount ? 900 : 600)} mm
            (follows side height).
          </p>
        ) : (
          <label>
            Carcass backing
            <select
              value={unit.carcass.backingType ?? 'none'}
              onChange={(e) => {
                const backingType = e.target.value as Unit['carcass']['backingType'];
                const carcass = { ...unit.carcass, backingType };
                if (backingType !== 'none' && carcass.visibleBackPanel?.enabled) {
                  carcass.visibleBackPanel = { ...carcass.visibleBackPanel, enabled: false };
                }
                const nextUnit = { ...unit, carcass };
                // Wall / tall floor + melamine → auto Top filler = No Filler (user can still pick a board).
                // Also mirrored by the became-eligible effect above.
                if (shouldAutoSelectNoFiller(nextUnit)) {
                  carcass.fillerMaterialId = NO_FILLER_MATERIAL_ID;
                } else if (isNoFillerMaterialId(carcass.fillerMaterialId)) {
                  // Leaving melamine / wall-style while No Filler was set — restore a real board.
                  carcass.fillerMaterialId =
                    unit.carcass.leftMaterialId || unit.carcass.rightMaterialId || defaultMat;
                  carcass.fillerEdgingMaterialId = defaultEdgingForMaterial(carcass.fillerMaterialId);
                }
                onChange({ ...unit, carcass });
              }}
            >
              {Object.entries(BACKING_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        )}
        {!cornerMount && unit.carcass.backingType === 'none' && (
          <div className="visible-back-panel-fields">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={unit.carcass.visibleBackPanel?.enabled ?? false}
                onChange={(e) => {
                  if (e.target.checked) {
                    setVisibleBackPanel({
                      enabled: true,
                      widthMm: unit.carcass.visibleBackPanel?.widthMm ?? unit.width,
                      heightMm: unit.carcass.visibleBackPanel?.heightMm ?? unit.height,
                    });
                  } else {
                    setVisibleBackPanel({ enabled: false });
                  }
                }}
              />
              Visible back panel (external)
            </label>
            {unit.carcass.visibleBackPanel?.enabled && (() => {
              const backMatId = resolveVisibleBackPanelMaterialId(unit, materials);
              const resolvedEdging = resolveVisibleBackPanelEdging(unit, backMatId, materials);
              const vbp = unit.carcass.visibleBackPanel!;
              return (
              <div className="form-grid form-grid-3">
                <label>
                  Back panel width (mm)
                  <NumberInput
                    min={1}
                    value={vbp.widthMm}
                    onChange={(n) => setVisibleBackPanel({ widthMm: Math.max(1, n) })}
                  />
                </label>
                <label>
                  Back panel height (mm)
                  <NumberInput
                    min={1}
                    value={vbp.heightMm}
                    onChange={(n) => setVisibleBackPanel({ heightMm: Math.max(1, n) })}
                  />
                </label>
                <label>
                  Material
                  <select
                    value={vbp.materialId ?? ''}
                    onChange={(e) => setVisibleBackPanel({ materialId: e.target.value || undefined })}
                  >
                    <option value="">Same as door / drawer front</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}{m.colour ? ` (${m.colour})` : ''}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Edging pattern
                  <select
                    value={vbp.edgingPattern ?? resolvedEdging.pattern}
                    onChange={(e) => setVisibleBackPanel({ edgingPattern: e.target.value as EdgingPattern })}
                  >
                    {Object.entries(EDGING_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
                {(vbp.edgingPattern ?? resolvedEdging.pattern) !== 'none' && (
                  <label>
                    Edging type
                    <select
                      value={vbp.edgingMaterialId ?? resolvedEdging.edgingMaterialId}
                      onChange={(e) => setVisibleBackPanel({ edgingMaterialId: e.target.value })}
                    >
                      {edgingMaterials.map((e) => (
                        <option key={e.id} value={e.id}>{e.name} ({e.thickness} mm)</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              );
            })()}
            <p className="hint">
              {unit.carcass.visibleBackPanel?.enabled ? (
                <>
                  Cut list: visible back{' '}
                  {unit.carcass.visibleBackPanel.heightMm} × {unit.carcass.visibleBackPanel.widthMm} mm
                  {' '}· material{' '}
                  {materials.find((m) => m.id === resolveVisibleBackPanelMaterialId(unit, materials))?.name ?? '—'}
                  {materials.find((m) => m.id === resolveVisibleBackPanelMaterialId(unit, materials))?.hasGrain
                    ? ' · grain top to bottom (same as doors/drawers)'
                    : ''}
                  {' '}· edging{' '}
                  {EDGING_LABELS[resolveVisibleBackPanelEdging(unit, resolveVisibleBackPanelMaterialId(unit, materials), materials).pattern] ?? '—'}
                  {' '}(
                  {edgingMaterials.find(
                    (e) => e.id === resolveVisibleBackPanelEdging(unit, resolveVisibleBackPanelMaterialId(unit, materials), materials).edgingMaterialId,
                  )?.name ?? '—'}
                  ).
                </>
              ) : (
                <>Optional finished back when the carcass has no internal backing. Defaults to cupboard width × height.</>
              )}
            </p>
          </div>
        )}
        {!cornerMount && unit.carcass.backingType === 'melamine' && (
          <label>
            Backing material
            <MaterialSelect value={unit.carcass.backingMaterialId ?? defaultMat} materials={materials} onChange={(v) => setCarcass('backingMaterialId', v)} />
          </label>
        )}
        <label>
          {cornerMount ? 'Filler material' : 'Top filler material'}
          <MaterialSelect
            value={fillerSelectValue}
            materials={materials}
            extraOptions={
              showNoFillerOption
                ? [{ id: NO_FILLER_MATERIAL_ID, label: 'No Filler' }]
                : undefined
            }
            onChange={(v) => {
              if (isNoFillerMaterialId(v)) {
                onChange({
                  ...unit,
                  carcass: {
                    ...unit.carcass,
                    fillerMaterialId: NO_FILLER_MATERIAL_ID,
                  },
                });
                return;
              }
              onChange({
                ...unit,
                carcass: {
                  ...unit.carcass,
                  fillerMaterialId: v,
                  fillerEdgingMaterialId: defaultEdgingForMaterial(v),
                },
              });
            }}
          />
          <span className="hint-inline">
            {floorCornerMount
              ? '2 × 748 × 100 mm'
              : wallCornerMount
                ? 'Filler 1/2/3 (same board)'
                : noFillerSelected
                  ? 'No top fillers on the cut list — pick a board to add them'
                  : showNoFillerOption
                    ? 'No Filler excludes top fillers from the cut list; pick a board to include them'
                    : 'Choose any board — independent of visible sides'}
          </span>
        </label>
        {wallCornerMount && (
          <label>
            Filler 1 width (mm)
            <NumberInput
              min={1}
              value={resolveWallCornerFiller1WidthMm(unit)}
              onChange={(n) => setCarcass('wallCornerFiller1WidthMm', Math.max(1, n))}
              title={`Length = side height − 2×${settings.thickness} mm`}
            />
            <span className="hint-inline">
              Length {wallCornerSizes?.filler1LengthMm ?? unit.height - 2 * settings.thickness} mm (H−2T) · qty 2
            </span>
          </label>
        )}
        {cornerMount && (
          <label>
            Filler edging pattern
            <select
              value={
                unit.carcass.fillerEdgingPattern ??
                (floorCornerMount ? FLOOR_CORNER_FILLER_EDGING : WALL_CORNER_FILLER_EDGING)
              }
              onChange={(e) => setCarcass('fillerEdgingPattern', e.target.value as EdgingPattern)}
            >
              {Object.entries(EDGING_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        )}
        {!noFillerSelected && (
          <label>
            Filler edging type
            <EdgingTypeSelect
              value={unit.carcass.fillerEdgingMaterialId}
              fallbackMaterialId={
                isNoFillerMaterialId(unit.carcass.fillerMaterialId)
                  ? (unit.carcass.leftMaterialId || defaultMat)
                  : (unit.carcass.fillerMaterialId || effectiveFillerId)
              }
              materials={materials}
              edgingMaterials={edgingMaterials}
              onChange={(v) => setCarcass('fillerEdgingMaterialId', v)}
            />
            <span className="hint-inline">
              {unit.type === 'bedroom' && !isFloor
                ? 'Used when side or top fillers are ticked'
                : wallStyleCarcass
                  ? 'Front & back top fillers'
                  : unit.carcass.countertopType === 'wooden'
                    ? '3 top fillers (front, back, centre) — same width × internal W as granite'
                    : 'Front & back top fillers (granite / stone top)'}
            </span>
          </label>
        )}
        {!noFillerSelected && (
          <label>
            Filler width (mm)
            <NumberInput value={unit.carcass.fillerWidth} onChange={(n) => setCarcass('fillerWidth', n)} />
          </label>
        )}
        {unit.type === 'bedroom' && !isFloor && (
          <>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={unit.carcass.sideFillers === true}
                onChange={(e) => {
                  const on = e.target.checked;
                  const side = resolveBedroomWallSideFiller(unit);
                  onChange({
                    ...unit,
                    carcass: {
                      ...unit.carcass,
                      sideFillers: on,
                      sideFillerWidth: unit.carcass.sideFillerWidth ?? side.width,
                      sideFillerHeight: unit.carcass.sideFillerHeight ?? side.length,
                      sideFillerQty: unit.carcass.sideFillerQty ?? side.qty,
                    },
                  });
                }}
              />
              Side fillers
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={unit.carcass.topFillers === true}
                onChange={(e) => {
                  const on = e.target.checked;
                  const top = resolveBedroomWallTopFiller(unit);
                  onChange({
                    ...unit,
                    carcass: {
                      ...unit.carcass,
                      topFillers: on,
                      topFillerWidth: unit.carcass.topFillerWidth ?? top.width,
                      topFillerHeight: unit.carcass.topFillerHeight ?? top.length,
                      topFillerQty: unit.carcass.topFillerQty ?? top.qty,
                    },
                  });
                }}
              />
              Top fillers
            </label>
          </>
        )}
      </div>
      {unit.type === 'bedroom' && !isFloor && unit.carcass.sideFillers && (() => {
        const side = resolveBedroomWallSideFiller(unit);
        const sideEdging = resolveBedroomWallSideFillerEdging(unit.carcass);
        return (
          <>
            <div className="form-grid form-grid-4">
              <label>
                Side filler qty
                <NumberInput min={1} integer value={side.qty} onChange={(n) => setCarcass('sideFillerQty', Math.max(1, n))} />
              </label>
              <label>
                Side filler width (mm)
                <NumberInput min={1} integer value={side.width} onChange={(n) => setCarcass('sideFillerWidth', Math.max(1, n))} />
              </label>
              <label>
                Side filler length (mm)
                <NumberInput min={1} integer value={side.length} onChange={(n) => setCarcass('sideFillerHeight', Math.max(1, n))} />
              </label>
            </div>
            <FillerEdgingCheckboxes
              counts={sideEdging}
              onChange={(next) =>
                onChange({
                  ...unit,
                  carcass: {
                    ...unit.carcass,
                    sideFillerEdgingLongCount: next.long,
                    sideFillerEdgingShortCount: next.short,
                  },
                })
              }
            />
          </>
        );
      })()}
      {unit.type === 'bedroom' && !isFloor && unit.carcass.topFillers && (() => {
        const top = resolveBedroomWallTopFiller(unit);
        const topEdging = resolveBedroomWallTopFillerEdging(unit.carcass);
        return (
          <>
            <div className="form-grid form-grid-4">
              <label>
                Top filler qty
                <NumberInput min={1} integer value={top.qty} onChange={(n) => setCarcass('topFillerQty', Math.max(1, n))} />
              </label>
              <label>
                Top filler width (mm)
                <NumberInput min={1} integer value={top.width} onChange={(n) => setCarcass('topFillerWidth', Math.max(1, n))} />
              </label>
              <label>
                Top filler length (mm)
                <NumberInput min={1} integer value={top.length} onChange={(n) => setCarcass('topFillerHeight', Math.max(1, n))} />
              </label>
            </div>
            <FillerEdgingCheckboxes
              counts={topEdging}
              onChange={(next) =>
                onChange({
                  ...unit,
                  carcass: {
                    ...unit.carcass,
                    topFillerEdgingLongCount: next.long,
                    topFillerEdgingShortCount: next.short,
                  },
                })
              }
            />
          </>
        );
      })()}
      {unit.type === 'bedroom' && !isFloor && (
        <p className="hint">
          {unit.carcass.sideFillers || unit.carcass.topFillers
            ? 'Type qty, width and height yourself. Tick No edging or 1 Long / 2 Long / 1 short / 2 short. Cut only while the filler tick boxes are on.'
            : 'Tick side fillers and/or top fillers to add them. You set qty, both sizes, and edging.'}
        </p>
      )}
      {showTopFillers && (unit.carcass.backingType === 'melamine' || unit.carcass.countertopType === 'wooden') && (
        <p className="hint">
          {unit.carcass.backingType === 'melamine' && (() => {
            const mount = unit.carcass.mountType ?? 'floor';
            const fullHeightBack = mount === 'floor' || mount === 'tall_floor' || mount === 'wall';
            const backH = fullHeightBack
              ? unit.height - 2 * settings.thickness
              : unit.height - settings.thickness;
            return (
              <>
                Melamine back: {unit.width - 2 * settings.thickness} × {backH} mm (inside carcass
                {fullHeightBack ? '; grain along height' : ''}).
                {mount === 'floor'
                  ? (unit.carcass.countertopType ?? 'granite') === 'granite'
                    ? ' Granite top + solid back: 1 front filler only.'
                    : ' Non-granite top + solid back: 2 fillers (front + back).'
                  : wallStyleCarcass
                    ? noFillerSelected
                      ? ' Top fillers off (No Filler). Pick a board under Top filler material to add them.'
                      : ' Melamine back: Top filler defaults to No Filler; pick a board if you still want fillers.'
                    : ''}
              </>
            );
          })()}
          {unit.carcass.countertopType === 'wooden' &&
            !((unit.carcass.mountType ?? 'floor') === 'floor' && unit.carcass.backingType === 'melamine') && (
            <>
              {unit.carcass.backingType === 'melamine' ? ' ' : ''}
              Wooden / laminate top: 3 top fillers — each {unit.carcass.fillerWidth} × {unit.width - 2 * settings.thickness} mm
              (same as granite rails, plus one centre rail).
            </>
          )}
        </p>
      )}
      </CollapsibleSection>

      <CollapsibleSection title="Shelves" variant="nested">
        {floorCornerMount && (
          <p className="hint">
            Floor corner has one fixed shelf ({floorCornerSizes?.panelMm ?? 884}×{floorCornerSizes?.panelMm ?? 884} mm, no
            edging). Change shelf board under Carcass.
          </p>
        )}
        {wallCornerMount && (
          <p className="hint">
            Wall corner has two fixed shelves ({wallCornerSizes?.panelMm ?? 584}×{wallCornerSizes?.panelMm ?? 584} mm, no
            edging). Change shelf board under Carcass.
          </p>
        )}
        {spiceMount && (
          <p className="hint">Spice mount — no carcass shelf. Left/right spice shelves are on the cut list under spice parts.</p>
        )}
        {!spiceMount && !cornerMount && (unit.carcass.shelfQty ?? 0) <= 0 && (
          <p className="hint">No shelves on this unit.</p>
        )}
        {!spiceMount && !cornerMount && (unit.carcass.shelfQty ?? 0) > 0 && (
          <>
            <div className="form-grid form-grid-3">
              <label>
                Shelf quantity
                <NumberInput
                  min={1}
                  value={unit.carcass.shelfQty}
                  onChange={(n) => setCarcass('shelfQty', Math.max(1, n))}
                />
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
            <p className="hint">
              Shelves:{' '}
              {unit.carcass.backingType === 'melamine' ? unit.depth - settings.thickness : unit.depth} ×{' '}
              {unit.width - 2 * settings.thickness} mm
              {unit.carcass.backingType === 'melamine' ? ' (D−T with solid melamine back)' : ''}
              {' '}· 1 long edge front ({EDGING_LABELS['1_long']}).
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-sm danger"
              onClick={() => setCarcass('shelfQty', 0)}
            >
              Remove shelves
            </button>
          </>
        )}
        {!spiceMount && !cornerMount && (unit.carcass.shelfQty ?? 0) <= 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setCarcass('shelfQty', 1)}
          >
            + Add shelf
          </button>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Doors"
        variant="nested"
        headerAction={
          !cornerMount ? (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={usesCustomDoorSizes(unit)}
                onChange={(e) => {
                  const on = e.target.checked;
                  if (on) {
                    applyUnit({
                      ...unit,
                      customDoorSizes: true,
                      doors: seedCustomDoorHeights(unit.doors),
                    });
                  } else {
                    applyUnit({ ...unit, customDoorSizes: false });
                  }
                }}
              />
              Customize door sizes
            </label>
          ) : undefined
        }
      >
      <p className="hint">
        Cut list mode: <strong>{CUT_SIZE_MODE_LABELS[settings.cutSizeMode ?? 'final']}</strong>
        {(settings.cutSizeMode ?? 'final') === 'net'
          ? ' — finished sizes shown below; cut list deducts edging tape thickness from board.'
          : ' — cut list matches finished panel sizes (edging included in dimensions).'}
        {usesCustomDoorSizes(unit) && !cornerMount && (
          <> Type <strong>door height</strong> yourself; width still = opening − left − right gaps. Opening height is
          calculated (door + top/bottom gaps). Drawers then use the remaining carcass after door openings.</>
        )}
      </p>
      {floorCornerMount && (
        <p className="hint">
          Floor corner: two fixed-width doors (341 mm and 325 mm). Only top and bottom gaps apply. Door height = side
          height − top − bottom.
        </p>
      )}
      {wallCornerMount && (
        <p className="hint">
          Wall corner: two fixed-width doors (291 mm and 275 mm). Only top and bottom gaps apply. Door height = side
          height − top − bottom.
        </p>
      )}
      {!cornerMount && (unit.doors.length > 0 || unit.drawers.length > 0) && (
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
        const customDoorsOn = usesCustomDoorSizes(unit) && !cornerMount;
        const finishedDoorH = doorPanelHeight(layoutDoor, customDoorsOn);
        const doorOpeningAuto = customDoorsOn || cornerMount || hasActiveDrawers || unit.doors.length === 1;
        const cornerDoorLabel = floorCornerMount
          ? i === 0
            ? 'Door 1 (341 mm wide)'
            : 'Door 2 (325 mm wide)'
          : wallCornerMount
            ? i === 0
              ? 'Door 1 (291 mm wide)'
              : 'Door 2 (275 mm wide)'
            : `Door set ${i + 1}`;
        return (
        <div key={door.id} className="sub-card">
          <div className="sub-card-header">
            <strong>{cornerDoorLabel}</strong>
            {!cornerMount && (
              <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => applyUnit({ ...unit, doors: unit.doors.filter((d) => d.id !== door.id) })}>Remove</button>
            )}
          </div>
          <div className="form-grid form-grid-4">
            {!cornerMount && (
              <label>Qty per cupboard<NumberInput  min={1} value={door.qty} onChange={(n) => updateDoor(door.id, { qty: n })} /></label>
            )}
            <label>
              Hinges / door
              <input
                type="text"
                className="readonly"
                readOnly
                value={`${hingesPerDoorLeafForDoor(layoutDoor, customDoorsOn)} on the quote`}
                title="Same count as Hinge holes when factory drill is on. Default: 2 up to 1200 mm finished height, 4 above that."
              />
            </label>
            <label>
              {cornerMount ? 'Door width (mm)' : 'Opening width (mm)'}
              <input
                type="number"
                className="readonly"
                value={layoutDoor.openingWidth}
                readOnly
                title={cornerMount ? 'Corner unit — fixed door width' : 'Matches cupboard width'}
              />
            </label>
            <label>
              Opening height (mm)
              <NumberInput
                className={doorOpeningAuto ? 'readonly' : undefined}
                readOnly={doorOpeningAuto}
                value={layoutDoor.openingHeight}
                title={
                  customDoorsOn
                    ? 'Calculated from door height + top/bottom gaps — display only'
                    : cornerMount
                      ? 'Matches side height'
                      : doorOpeningAuto
                        ? (hasActiveDrawers ? 'Carcass height minus active drawer rows' : 'Full carcass height')
                        : 'Split between door rows — scales with cupboard height'
                }
                onChange={(n) => updateDoor(door.id, { openingHeight: n })}
              />
            </label>
            {!cornerMount && (
              <label>
                Door height (mm)
                <NumberInput
                  className={!customDoorsOn ? 'readonly' : ''}
                  min={1}
                  value={customDoorsOn ? (door.doorHeightMm ?? finishedDoorH) : finishedDoorH}
                  readOnly={!customDoorsOn}
                  title={
                    customDoorsOn
                      ? 'Finished door panel height — grain top to bottom'
                      : 'Auto from opening − gaps — tick Customize door sizes to type this'
                  }
                  onChange={(n) => updateDoor(door.id, { doorHeightMm: Math.max(1, Math.round(n)) })}
                />
              </label>
            )}
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
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={door.factoryHingeHoles !== false}
                onChange={(e) => updateDoor(door.id, { factoryHingeHoles: e.target.checked })}
              />
              Factory: drill hinge holes
            </label>
            {door.factoryHingeHoles !== false && (
              <label>
                Hinge holes
                <select
                  value={hingesPerDoorLeafForDoor(layoutDoor, customDoorsOn)}
                  title="Default 2 if the finished door is 1200 mm or shorter, 4 if taller. This is also how many hinges are priced."
                  onChange={(e) => updateDoor(door.id, { hingeHoleCount: Number(e.target.value) })}
                >
                  {HINGE_HOLE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="field-hint">
                  Default 2 up to 1200 mm, 4 above. Priced as this many hinges per door.
                </span>
              </label>
            )}
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
                {getHingeGroupsForJob(job).map((group) => (
                  <optgroup key={group.category} label={group.label}>
                    {group.hinges.map((h) => (
                      <option key={h.id} value={h.id} disabled={h.outOfStockOnline}>
                        {h.shortName}{h.outOfStockOnline ? ' (out of stock online)' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {usesGelmarCatalog(job, 'hinges') && (
                  <option value="custom">Custom hinge (manual price)</option>
                )}
              </select>
              {door.hinge?.type === 'preset' && (() => {
                const sel = getHingeByIdForJob(job, door.hinge.presetId);
                if (!sel) return null;
                return (
                  <span className="field-hint">
                    {sel.name}
                    {usesGelmarCatalog(job, 'hinges') && sel.url && (
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
          <div className={`form-grid ${cornerMount ? 'form-grid-2' : 'form-grid-5'} door-gaps-grid`}>
            {!cornerMount && (
              <>
                <label>
                  Left
                  <NumberInput  min={0} step={0.5} value={resolveDoorGaps(door).left} onChange={(n) => updateDoorGap(door.id, 'left', n)} />
                </label>
                <label>
                  Right
                  <NumberInput  min={0} step={0.5} value={resolveDoorGaps(door).right} onChange={(n) => updateDoorGap(door.id, 'right', n)} />
                </label>
              </>
            )}
            <label>
              Top
              <NumberInput
                min={0}
                step={0.5}
                value={resolveDoorGaps(door).top}
                onChange={(n) => updateDoorGap(door.id, 'top', n)}
              />
            </label>
            <label>
              Bottom
              <NumberInput
                min={0}
                step={0.5}
                value={resolveDoorGaps(door).bottom}
                onChange={(n) => updateDoorGap(door.id, 'bottom', n)}
              />
            </label>
            {!cornerMount && door.qty > 1 && (
              <label>
                Between doors
                <NumberInput  min={0} step={0.5} value={resolveDoorGaps(door).between} onChange={(n) => updateDoorGap(door.id, 'between', n)} />
              </label>
            )}
          </div>
          <p className="hint">{doorSizeSummary(layoutDoor, { settings, edgingMaterials, materials }, customDoorsOn)}</p>
        </div>
        );
      })}
      {!cornerMount && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={addDoor}>+ Add doors</button>
      )}
      </CollapsibleSection>

      {!cornerMount && (
      <CollapsibleSection title="Drawers" variant="nested">
      <p className="hint">
        Drawers stack <strong>vertically</strong> on the front — one full-width front per row. Use <strong>+ Add drawers</strong> for another row.
        <strong> Qty per cupboard</strong> = how many matching drawers on that row (e.g. 4 = four same height). Different heights = separate rows with qty 1 each.
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={usesCustomDrawerSizes(unit)}
          onChange={(e) => {
            const on = e.target.checked;
            if (on) {
              applyUnit({
                ...unit,
                customDrawerSizes: true,
                drawers: seedCustomFrontHeights(unit.drawers, unit.height),
              });
            } else {
              applyUnit({ ...unit, customDrawerSizes: false });
            }
          }}
        />
        Customize drawer / front sizes
      </label>
      <p className="hint">
        {usesCustomDrawerSizes(unit) ? (
          <>
            Custom: type <strong>front height</strong> and <strong>box height</strong> per row. Front width = opening − left − right
            gaps (grain top → bottom). Opening height is calculated for display (front + gaps). Warns if drawers + doors exceed
            carcass height — cut list still runs.
          </>
        ) : (
          <>
            Cut list mode: <strong>{CUT_SIZE_MODE_LABELS[settings.cutSizeMode ?? 'final']}</strong>.
            Front height auto = (carcass H − top − bottom − 4 mm between fronts) ÷ qty. Tick customize to type front height yourself.
            {(settings.cutSizeMode ?? 'final') === 'net'
              ? ' Cut list board size deducts edging thickness.'
              : ' Cut list shows finished size after edge banding.'}
          </>
        )}
      </p>
      {frontStackOverflowWarning(layoutUnit) && (
        <p className="hint warn">{frontStackOverflowWarning(layoutUnit)}</p>
      )}
      {unit.doors.length > 0 && !usesCustomDoorSizes(unit) && (
        <p className="hint warn">
          This unit already has a door. Turn on <strong>Customize door sizes</strong> if you want a fixed door height with
          drawers on the same front; otherwise openings auto-split the carcass.
        </p>
      )}
      {unit.drawers.length === 0 && (
        <p className="hint">
          No drawers on this unit. Click <strong>+ Add drawers</strong> to include drawer fronts, box parts, runners, and drawer bottoms on the cut list.
        </p>
      )}
      {unit.drawers.map((drawer, i) => {
        const layoutDrawer = layoutUnit.drawers.find((d) => d.id === drawer.id) ?? drawer;
        const customOn = usesCustomDrawerSizes(unit);
        const finishedFrontW = drawerFrontWidth(layoutDrawer);
        const finishedFrontH = drawerFrontHeight(
          layoutDrawer,
          unit.height,
          layoutUnit.drawers,
          customOn,
        );
        const frontVsBoxWarn = drawerFrontVsBoxWarning(
          layoutDrawer,
          unit.height,
          layoutUnit.drawers,
          customOn,
        );
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
          {frontVsBoxWarn && <p className="hint warn">{frontVsBoxWarn}</p>}
          <div className="form-grid form-grid-4">
            <label className={drawer.qty <= 0 ? 'qty-inactive' : ''}>
              Qty per cupboard
              <NumberInput  min={0} value={drawer.qty} onChange={(n) => setDrawerQty(drawer.id, n)} />
            </label>
            <label>
              Opening width (mm)
              <input type="number" className="readonly" value={layoutDrawer.openingWidth} readOnly title="Matches cupboard width" />
            </label>
            <label>
              Opening height (mm)
              <NumberInput
                className="readonly"
                min={1}
                value={layoutDrawer.openingHeight}
                readOnly
                title={
                  customOn
                    ? 'Calculated from front height + top/bottom gaps (and gap to door) — display only'
                    : isActiveDrawer(drawer)
                      ? 'Auto from carcass height, qty, 4 mm gaps between fronts, and top/bottom gaps'
                      : 'Inactive — set qty to 0; does not affect door'
                }
                onChange={() => {}}
              />
            </label>
            <label>
              Front height (mm)
              <NumberInput
                className={!customOn ? 'readonly' : ''}
                min={1}
                value={customOn ? (drawer.frontHeightMm ?? finishedFrontH) : finishedFrontH}
                readOnly={!customOn}
                title={
                  customOn
                    ? 'Finished drawer front height — grain runs top to bottom'
                    : 'Auto from carcass — tick Customize drawer / front sizes to type this'
                }
                onChange={(n) => updateDrawer(drawer.id, { frontHeightMm: Math.max(1, Math.round(n)) })}
              />
            </label>
            <label>
              Front width (mm)
              <input
                type="number"
                className="readonly"
                value={Math.round(finishedFrontW * 10) / 10}
                readOnly
                title="Opening width − left − right gaps (and between if side-by-side fronts)"
              />
            </label>
            <label>
              Box height (mm)
              <NumberInput
                min={1}
                value={drawer.boxHeight}
                title="Drawer box front/back/sides on cut list — you set this"
                onChange={(n) => updateDrawer(drawer.id, { boxHeight: Math.max(1, n) })}
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
            {drawerBoxFrontBackWidthNote(unit.width, settings.thickness, drawer.sideClearance ?? getRunnerClearancesForJob(job, drawer.runner).sideClearance)}
          </p>
          <p className="hint">
            Box sides ({EDGING_LABELS[DRAWER_BOX_SIDE_EDGING]}):{' '}
            {drawerBoxSideDepthNote(unit.depth, drawer.backClearance ?? 25, settings.thickness)} × box height
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
                      <option key={p.id} value={p.id}>{p.shortName}</option>
                    ))}
                  </optgroup>
                ))}
                {usesGelmarCatalog(job, 'runners') && (
                  <option value="custom">Custom clearances</option>
                )}
              </select>
              {drawer.runner.type === 'preset' && (() => {
                const sel = getRunnerByIdForJob(job, drawer.runner.presetId);
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
                <NumberInput
                  
                  value={drawer.runner.customDepthDeduction ?? 25}
                  onChange={(n) => updateDrawer(drawer.id, { runner: { ...drawer.runner, customDepthDeduction: n } })}
                />
              </label>
            )}
          </div>
          <h4 className="subsection-title">Drawer front gaps (mm)</h4>
          <div className="form-grid form-grid-5 door-gaps-grid">
            <label>
              Left
              <NumberInput  min={0} step={0.5} value={resolveDrawerGaps(drawer).left} onChange={(n) => updateDrawerGap(drawer.id, 'left', n)} />
            </label>
            <label>
              Right
              <NumberInput  min={0} step={0.5} value={resolveDrawerGaps(drawer).right} onChange={(n) => updateDrawerGap(drawer.id, 'right', n)} />
            </label>
            <label>
              Top
              <NumberInput  min={0} step={0.5} value={resolveDrawerGaps(drawer).top} onChange={(n) => updateDrawerGap(drawer.id, 'top', n)} />
            </label>
            <label>
              Bottom
              <NumberInput  min={0} step={0.5} value={resolveDrawerGaps(drawer).bottom} onChange={(n) => updateDrawerGap(drawer.id, 'bottom', n)} />
            </label>
            {resolveFrontQty(drawer) > 1 && (
              <label>
                Between fronts
                <NumberInput  min={0} step={0.5} value={resolveDrawerGaps(drawer).between} onChange={(n) => updateDrawerGap(drawer.id, 'between', n)} />
              </label>
            )}
            {unit.doors.length > 0 && (
              <label>
                Gap to door
                <NumberInput  min={0} step={0.5} value={resolveGapToDoor(drawer)} onChange={(n) => updateDrawer(drawer.id, { gapToDoorMm: Math.max(0, n) })} />
              </label>
            )}
          </div>
          <p className="hint">
            {isActiveDrawer(drawer) ? (
              customOn ? (
                <>
                  Custom front {finishedFrontW} × {finishedFrontH} mm (grain top → bottom). Box height = {drawer.boxHeight} mm.
                  Opening height ({layoutDrawer.openingHeight} mm) is calculated from front + gaps
                  {unit.doors.length > 0 ? ` · includes ${resolveGapToDoor(drawer)} mm gap to door` : ''} — display only.
                </>
              ) : (
                <>
                  Drawer front height comes from carcass ÷ qty (see summary below). Box height = {drawer.boxHeight} mm on cut list.
                  Opening row = top + stacked fronts + bottom gaps{unit.doors.length > 0 ? ` + ${resolveGapToDoor(drawer)} mm to door` : ''} = {layoutDrawer.openingHeight} mm.
                </>
              )
            ) : (
              <>Qty 0 — drawer not on cut list. Door uses full carcass height ({unit.height} mm opening).</>
            )}
          </p>
          <p className="hint">{drawerSizeSummary(layoutDrawer, { settings, edgingMaterials, materials }, unit.doors.length > 0, unit.height, unit.drawers, customOn)}</p>
          <h4 className="subsection-title">Drawer box clearances</h4>
          <p className="hint">Side clearance = gap each side for the runners. Front/back = gap behind the drawer front and at the rear of the box.</p>
          <div className="form-grid form-grid-3 drawer-clearances">
            <label>
              Side clearance (mm)
              <NumberInput
                
                min={0}
                step={0.1}
                value={drawer.sideClearance ?? getRunnerClearancesForJob(job, drawer.runner).sideClearance}
                onChange={(n) => {
                  const sideClearance = n;
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
            <label>Front clearance (mm)<NumberInput  min={0} value={drawer.frontClearance} onChange={(n) => updateDrawer(drawer.id, { frontClearance: n })} /></label>
            <label>Back clearance (mm)<NumberInput  min={0} value={drawer.backClearance} onChange={(n) => updateDrawer(drawer.id, { backClearance: n })} /></label>
          </div>
        </div>
        );
      })}
      <button type="button" className="btn btn-secondary btn-sm" onClick={addDrawer}>+ Add drawers</button>
      </CollapsibleSection>
      )}

      <CollapsibleSection
          title="Extras"
          variant="nested"
          headerAction={
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={unit.extrasEnabled === true}
                onChange={(e) => onChange({ ...unit, extrasEnabled: e.target.checked })}
              />
              Include extras
            </label>
          }
        >
          <p className="hint">
            {unit.extrasEnabled
              ? usesBedroomExtrasForm(unit)
                ? 'Bedroom inner boxes: sides/bottom, optional top, shelves, division, drawer stacks (typed drawer carcass). No kickplate or feet on the extra.'
                : 'Kitchen / wall: add custom doors, panels, and fillers with your own length, width, qty, board, edging pattern, and tape.'
              : 'Extras are off for this unit — nothing from this section is added to the cut list. Tick Include extras to enable.'}
          </p>
          {usesBedroomExtrasForm(unit) &&
            (unit.extras ?? []).map((extra, i) => (
              <ExtraInnerForm
                key={extra.id}
                index={i}
                job={job}
                unit={unit}
                extra={extra}
                materials={materials}
                edgingMaterials={edgingMaterials}
                settings={settings}
                disabled={unit.extrasEnabled !== true}
                onChange={(next) => {
                  const extras = [...(unit.extras ?? [])];
                  extras[i] = next;
                  onChange({ ...unit, extras });
                }}
                onRemove={() => {
                  onChange({ ...unit, extras: (unit.extras ?? []).filter((e) => e.id !== extra.id) });
                }}
              />
            ))}
          {usesBedroomExtrasForm(unit) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={unit.extrasEnabled !== true}
              onClick={() => {
                const extra = defaultBedroomWallExtra(unit, defaultEdgingForMaterial(unit.carcass.leftMaterialId));
                onChange({ ...unit, extras: [...(unit.extras ?? []), extra] });
              }}
            >
              + Add extra inner unit
            </button>
          )}
          {usesCustomExtrasForm(unit) && (
            <ExtraCustomPartsForm
              job={job}
              unit={unit}
              parts={unit.customExtras ?? []}
              materials={materials}
              edgingMaterials={edgingMaterials}
              disabled={unit.extrasEnabled !== true}
              onChange={(customExtras) => onChange({ ...unit, customExtras })}
            />
          )}
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

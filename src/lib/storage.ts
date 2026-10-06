import {
  DEFAULT_EDGING,
  DEFAULT_MATERIALS,
  DEFAULT_MASONITE,
  DEFAULT_PLASTIC_KICKPLATE,
  DEFAULT_RUNNER_PRICES,
  DEFAULT_HINGE_PRICES,
  DEFAULT_SCREW_PRICES,
  DEFAULT_CONNECTING_FITTING_PRICES,
  DEFAULT_INSTALL_RATES,
  DEFAULT_SETTINGS,
  defaultPlinth,
  isKitchenBase,
} from './constants';
import { getDefaultRunnerPrices, getRunnerClearances } from './runnerCatalog';
import { DEFAULT_HINGE_PRESET_ID, getDefaultHingePrices } from './hingeCatalog';
import { getDefaultConnectingFittingPrices } from './connectingFittingCatalog';
import { getDefaultScrewPrices } from './screwCatalog';
import type { Client, DoorConfig, DoorGaps, DrawerConfig, EdgingMaterial, Job, Material, Unit } from '../types';
import { DEFAULT_DOOR_GAPS } from './doorRules';
import { DEFAULT_DRAWER_GAPS, DEFAULT_FRONT_OVERHANG_MM, DEFAULT_GAP_TO_DOOR_MM, syncDrawerOpeningFromFront } from './drawerRules';
import { syncFrontLayoutToUnit } from './frontLayout';

const STORAGE_KEY = 'cuboards_jobs';

function migrateDoor(d: DoorConfig & { gap?: number }, materials: Material[], edgingMaterials: EdgingMaterial[]): DoorConfig {
  const boardMat = materials.find((m) => m.id === d.materialId);
  const legacyGap = d.gap;
  const gaps: DoorGaps = d.gaps ?? {
    left: DEFAULT_DOOR_GAPS.left,
    right: DEFAULT_DOOR_GAPS.right,
    top: DEFAULT_DOOR_GAPS.top,
    bottom: DEFAULT_DOOR_GAPS.bottom,
    between: legacyGap ?? DEFAULT_DOOR_GAPS.between,
  };
  return {
    ...d,
    gaps,
    edgingMaterialId: d.edgingMaterialId ?? boardMat?.edgingMaterialId ?? edgingMaterials[0]?.id ?? '',
    hinge: d.hinge ?? { type: 'preset', presetId: DEFAULT_HINGE_PRESET_ID },
  };
}

function migrateDrawer(
  d: DrawerConfig,
  unit: Unit,
  materials: Material[],
  edgingMaterials: EdgingMaterial[],
): DrawerConfig {
  const legacyMaterial = d.boxMaterialId ?? d.frontMaterialId ?? d.materialId ?? materials[0]?.id ?? '';
  const boxMaterialId = d.boxMaterialId ?? d.materialId ?? legacyMaterial;
  const frontMaterialId = d.frontMaterialId ?? d.materialId ?? legacyMaterial;
  const boxBoardMat = materials.find((m) => m.id === boxMaterialId);
  const frontBoardMat = materials.find((m) => m.id === frontMaterialId);
  const fromRunner = getRunnerClearances(d.runner);
  const sideClearance =
    d.sideClearance ??
    (d.runner.type === 'custom'
      ? (d.runner.customSideClearance ?? fromRunner.sideClearance)
      : fromRunner.sideClearance);
  return syncDrawerOpeningFromFront(
    {
      ...d,
      boxMaterialId,
      frontMaterialId,
      sideClearance,
      frontOverhangMm: d.frontOverhangMm ?? DEFAULT_FRONT_OVERHANG_MM,
      frontQty: d.frontQty ?? 1,
      gapToDoorMm: d.gapToDoorMm ?? DEFAULT_GAP_TO_DOOR_MM,
      openingWidth: d.openingWidth ?? unit.width,
      openingHeight: d.openingHeight ?? unit.height,
      gaps: d.gaps ?? { ...DEFAULT_DRAWER_GAPS, between: DEFAULT_DRAWER_GAPS.between },
      frontEdgingPattern: d.frontEdgingPattern ?? '2_long_2_short',
      frontEdgingMaterialId: d.frontEdgingMaterialId ?? frontBoardMat?.edgingMaterialId ?? edgingMaterials[0]?.id ?? '',
      boxFrontBackEdgingPattern: d.boxFrontBackEdgingPattern ?? '1_long_2_short',
      boxSideEdgingPattern: d.boxSideEdgingPattern ?? d.boxEdgingPattern ?? '1_long',
      boxEdgingMaterialId: d.boxEdgingMaterialId ?? boxBoardMat?.edgingMaterialId ?? edgingMaterials[0]?.id ?? '',
    },
    (unit.doors?.length ?? 0) > 0,
  );
}

const emptyClient = (): Client => ({
  name: '',
  phone: '',
  address: '',
  ref: '',
  notes: '',
});

export function createNewJob(): Job {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    client: emptyClient(),
    settings: { ...DEFAULT_SETTINGS },
    materials: DEFAULT_MATERIALS.map((m) => ({ ...m })),
    edgingMaterials: DEFAULT_EDGING.map((e) => ({ ...e })),
    masonite: { ...DEFAULT_MASONITE },
    plasticKickplate: { ...DEFAULT_PLASTIC_KICKPLATE },
    runnerPrices: { ...DEFAULT_RUNNER_PRICES },
    hingePrices: { ...DEFAULT_HINGE_PRICES },
    screwPrices: { ...DEFAULT_SCREW_PRICES },
    connectingFittingPrices: { ...DEFAULT_CONNECTING_FITTING_PRICES },
    installRates: { ...DEFAULT_INSTALL_RATES },
    units: [],
  };
}

function migrateMaterial(m: Material, defaultEdgingId: string): Material {
  return {
    ...m,
    edgingMaterialId: m.edgingMaterialId ?? defaultEdgingId,
  };
}

export function migrateJob(job: Job): Job {
  const edgingMaterials = job.edgingMaterials?.length
    ? job.edgingMaterials
    : DEFAULT_EDGING.map((e) => ({ ...e }));
  const defaultEdgingId = edgingMaterials[0]?.id ?? 'edge-white-1';

  return {
    ...job,
    edgingMaterials,
    masonite: job.masonite ?? { ...DEFAULT_MASONITE },
    plasticKickplate: job.plasticKickplate ?? { ...DEFAULT_PLASTIC_KICKPLATE },
    runnerPrices: { ...getDefaultRunnerPrices(), ...job.runnerPrices },
    hingePrices: { ...getDefaultHingePrices(), ...job.hingePrices },
    screwPrices: { ...getDefaultScrewPrices(), ...job.screwPrices },
    connectingFittingPrices: { ...getDefaultConnectingFittingPrices(), ...job.connectingFittingPrices },
    installRates: { ...DEFAULT_INSTALL_RATES, ...job.installRates },
    settings: {
      ...DEFAULT_SETTINGS,
      ...job.settings,
    },
    materials: (job.materials ?? []).map((m) => migrateMaterial(m, defaultEdgingId)),
    units: (job.units ?? []).map((u) => {
      const unitQty = u.unitQty ?? 1;
      const defaultMat = job.materials?.[0]?.id ?? 'mat-white';
      const plinth = isKitchenBase(u.type)
        ? {
            ...(u.plinth ?? defaultPlinth({ settings: { ...DEFAULT_SETTINGS, ...job.settings }, materials: job.materials ?? [] }, u.carcass?.leftMaterialId)),
            kickplateType: u.plinth?.kickplateType ?? 'wood',
            kickplateCoverage: u.plinth?.kickplateCoverage ?? 'front',
            kickplateSide: u.plinth?.kickplateSide ?? 'left',
            feetRequired: u.plinth?.feetRequired ?? true,
          }
        : undefined;
      const carcass = u.carcass ?? {};
      const mountType = carcass.mountType ?? (u.type === 'wall' ? 'wall' : 'floor');
      const leftMat = (job.materials ?? []).find((m) => m.id === carcass.leftMaterialId);
      const rightMat = (job.materials ?? []).find((m) => m.id === carcass.rightMaterialId);
      const bottomMat = (job.materials ?? []).find((m) => m.id === (carcass.bottomMaterialId ?? defaultMat));
      const fillerMat = (job.materials ?? []).find((m) => m.id === (carcass.fillerMaterialId ?? defaultMat));
      const shelfMat = (job.materials ?? []).find((m) => m.id === (carcass.shelfMaterialId ?? defaultMat));
      const fillerEdgingDefault =
        carcass.fillerEdgingMaterialId ??
        leftMat?.edgingMaterialId ??
        fillerMat?.edgingMaterialId ??
        defaultEdgingId;
      return syncFrontLayoutToUnit({
        ...u,
        unitQty,
        plinth,
        carcass: {
          ...carcass,
          backingType: carcass.backingType ?? 'none',
          backingMaterialId: carcass.backingMaterialId ?? carcass.bottomMaterialId ?? defaultMat,
          countertopType: carcass.countertopType ?? 'granite',
          mountType,
          leftEdgingMaterialId: carcass.leftEdgingMaterialId ?? leftMat?.edgingMaterialId ?? defaultEdgingId,
          rightEdgingMaterialId: carcass.rightEdgingMaterialId ?? rightMat?.edgingMaterialId ?? defaultEdgingId,
          bottomEdgingMaterialId: carcass.bottomEdgingMaterialId ?? bottomMat?.edgingMaterialId ?? defaultEdgingId,
          shelfEdgingMaterialId: carcass.shelfEdgingMaterialId ?? shelfMat?.edgingMaterialId ?? defaultEdgingId,
          fillerEdgingMaterialId: fillerEdgingDefault,
        },
        doors: (u.doors ?? []).map((d) => migrateDoor(d, job.materials ?? [], edgingMaterials)),
        drawers: (u.drawers ?? []).map((d) => migrateDrawer(d, u, job.materials ?? [], edgingMaterials)),
      });
    }),
  };
}

export function loadJobs(): Job[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Job[]).map(migrateJob);
  } catch {
    return [];
  }
}

export function saveJobs(jobs: Job[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

export function upsertJob(jobs: Job[], job: Job): Job[] {
  const updated = migrateJob({ ...job, updatedAt: new Date().toISOString() });
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) {
    const next = [...jobs];
    next[idx] = updated;
    return next;
  }
  return [updated, ...jobs];
}

export function deleteJob(jobs: Job[], id: string): Job[] {
  return jobs.filter((j) => j.id !== id);
}

export function exportJobJson(job: Job): void {
  const blob = new Blob([JSON.stringify(job, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cuboards-${job.client.ref || job.client.name || job.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJobJson(file: File): Promise<Job> {
  return file.text().then((text) => {
    const job = migrateJob(JSON.parse(text) as Job);
    if (!job.id || !job.settings) throw new Error('Invalid job file');
    return { ...job, id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
  });
}

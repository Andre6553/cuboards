import type { EdgingPattern, Job, KitchenPlinthConfig } from '../types';
import { getBoardEdgingThickness } from './edgingCutSize';

export type KickplateEdgingLongCount = 0 | 1 | 2;
export type KickplateEdgingShortCount = 0 | 1 | 2;

/**
 * Kickplate edging (matches unit form checkboxes and factory L/B ticks on cut list):
 * - **long** — edges parallel to the kick **run** (piece width; top/bottom when grain runs along height)
 * - **short** — edges parallel to kick **height** (piece length; vertical sides)
 *
 * Cut list order is height × run (`longAlong: length`). Factory **L** = short count, **B** = long count.
 */
export interface KickplateEdgingCounts {
  long: KickplateEdgingLongCount;
  short: KickplateEdgingShortCount;
}

export function kickplateEdgingFromLegacyPattern(pattern?: EdgingPattern): KickplateEdgingCounts {
  switch (pattern) {
    case 'none':
      return { long: 0, short: 0 };
    case '2_long':
      return { long: 2, short: 0 };
    case '1_long_1_short':
      return { long: 1, short: 1 };
    case '1_long_2_short':
      return { long: 1, short: 2 };
    case '2_long_2_short':
      return { long: 2, short: 2 };
    case '1_long':
    default:
      return { long: 1, short: 0 };
  }
}

export function resolveKickplateEdgingCounts(plinth: KitchenPlinthConfig): KickplateEdgingCounts {
  if (plinth.kickplateEdgingLongCount !== undefined || plinth.kickplateEdgingShortCount !== undefined) {
    return {
      long: (plinth.kickplateEdgingLongCount ?? 0) as KickplateEdgingLongCount,
      short: (plinth.kickplateEdgingShortCount ?? 0) as KickplateEdgingShortCount,
    };
  }
  return kickplateEdgingFromLegacyPattern(plinth.kickplateEdgingPattern);
}

export function kickplateEdgingSummary(counts: KickplateEdgingCounts): string {
  const { long, short } = counts;
  if (long === 0 && short === 0) return 'No edging';
  const parts: string[] = [];
  if (long === 1) parts.push('1 Long');
  if (long === 2) parts.push('2 Long');
  if (short === 1) parts.push('1 short');
  if (short === 2) parts.push('2 short');
  return parts.join(' + ');
}

/** Total edging tape (mm) for one kickplate piece: width = run, length = height. */
export function kickplateEdgingRunMm(
  counts: KickplateEdgingCounts,
  runMm: number,
  heightMm: number,
): number {
  if (counts.long <= 0 && counts.short <= 0) return 0;
  return counts.long * runMm + counts.short * heightMm;
}

/** Net board size — run on width, height on length. */
export function deductKickplateEdgingDimensions(
  runMm: number,
  heightMm: number,
  counts: KickplateEdgingCounts,
  thickness: number,
): { width: number; length: number } {
  if (thickness <= 0 || (counts.long <= 0 && counts.short <= 0)) {
    return { width: runMm, length: heightMm };
  }
  return {
    width: Math.max(0, runMm - counts.short * thickness),
    length: Math.max(0, heightMm - counts.long * thickness),
  };
}

export function applyKickplateCutSizeMode(
  job: Job,
  boardMaterialId: string,
  runMm: number,
  heightMm: number,
  counts: KickplateEdgingCounts,
  edgingMaterialIdOverride?: string,
): { width: number; length: number; sizeNote: string } {
  const mode = job.settings.cutSizeMode ?? 'final';
  if (mode !== 'net' || (counts.long <= 0 && counts.short <= 0)) {
    return { width: runMm, length: heightMm, sizeNote: '' };
  }
  const thickness = edgingMaterialIdOverride
    ? (job.edgingMaterials.find((e) => e.id === edgingMaterialIdOverride)?.thickness ?? 0)
    : getBoardEdgingThickness(job, boardMaterialId);
  if (thickness <= 0) {
    return { width: runMm, length: heightMm, sizeNote: '' };
  }
  const adjusted = deductKickplateEdgingDimensions(runMm, heightMm, counts, thickness);
  return {
    width: adjusted.width,
    length: adjusted.length,
    sizeNote: `Net cut (−${thickness} mm per edged edge)`,
  };
}

/** Factory row: length column = height, width column = run. */
export function kickplateEdgingToFactoryTicks(counts: KickplateEdgingCounts): {
  l1: boolean;
  l2: boolean;
  b1: boolean;
  b2: boolean;
} {
  return {
    l1: counts.short >= 1,
    l2: counts.short >= 2,
    b1: counts.long >= 1,
    b2: counts.long >= 2,
  };
}

export function formatKickplateEdgingLabel(
  job: Job,
  counts: KickplateEdgingCounts,
  edgingMaterialId: string,
): string {
  const summary = kickplateEdgingSummary(counts);
  if (summary === 'No edging') return summary;
  const em = job.edgingMaterials.find((e) => e.id === edgingMaterialId);
  if (!em) return summary;
  return `${summary} · ${em.name} (${em.thickness} mm)`;
}

export function kickplateEdgingGroupKey(job: Job, counts: KickplateEdgingCounts, edgingMaterialId: string): string {
  const summary = kickplateEdgingSummary(counts);
  if (summary === 'No edging') return 'none';
  const em = job.edgingMaterials.find((e) => e.id === edgingMaterialId);
  return `kp|${summary}|${em?.name ?? '—'}|${em?.thickness ?? 0}`;
}

export type KickplateEdgingToggle = 'none' | 'long1' | 'long2' | 'short1' | 'short2';

/** Checkbox rules: no edging clears all; 1 Long / 2 Long exclusive; 1 short / 2 short exclusive. */
export function applyKickplateEdgingToggle(
  current: KickplateEdgingCounts,
  key: KickplateEdgingToggle,
  checked: boolean,
): KickplateEdgingCounts {
  let { long, short } = current;

  if (key === 'none') {
    return checked ? { long: 0, short: 0 } : { long: 1, short: 0 };
  }

  if (key === 'long1') {
    if (checked) long = 1;
    else if (long === 1) long = 0;
  } else if (key === 'long2') {
    if (checked) long = 2;
    else if (long === 2) long = 0;
  } else if (key === 'short1') {
    if (checked) short = 1;
    else if (short === 1) short = 0;
  } else if (key === 'short2') {
    if (checked) short = 2;
    else if (short === 2) short = 0;
  }

  return { long, short };
}

export function isKickplateEdgingChecked(counts: KickplateEdgingCounts, key: KickplateEdgingToggle): boolean {
  const { long, short } = counts;
  switch (key) {
    case 'none':
      return long === 0 && short === 0;
    case 'long1':
      return long === 1;
    case 'long2':
      return long === 2;
    case 'short1':
      return short === 1;
    case 'short2':
      return short === 2;
    default:
      return false;
  }
}

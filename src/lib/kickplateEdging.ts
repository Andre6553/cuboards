import type { EdgingPattern, KitchenPlinthConfig } from '../types';

export type KickplateEdgingLongCount = 0 | 1 | 2;
export type KickplateEdgingShortCount = 0 | 1 | 2;

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

/** Best-fit pattern for cut-list grouping; edge counts drive tape length when they differ. */
export function resolveKickplateEdgingPattern(counts: KickplateEdgingCounts): EdgingPattern {
  const { long, short } = counts;
  if (long === 0 && short === 0) return 'none';
  if (long === 2 && short === 2) return '2_long_2_short';
  if (long === 2 && short === 0) return '2_long';
  if (long === 1 && short === 0) return '1_long';
  if (long === 1 && short === 1) return '1_long_1_short';
  if (long === 1 && short === 2) return '1_long_2_short';
  if (long === 2 && short === 1) return '2_long';
  if (long === 0 && short > 0) return 'none';
  return '1_long';
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

export type KickplateEdgingToggle = 'none' | 'long1' | 'long2' | 'short1' | 'short2';

/** Checkbox rules: no edging clears all; any edge clears no edging; 1 Long / 2 Long are exclusive. */
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

import type { EdgingPattern } from '../types';

/** Stored edging material id when pattern is `none` (no tape on cut list). */
export const NO_EDGING_MATERIAL_ID = '';

export function edgingMaterialIdForPattern(
  pattern: EdgingPattern,
  currentId: string | undefined,
  fallbackId: string,
): string {
  if (pattern === 'none') return NO_EDGING_MATERIAL_ID;
  const trimmed = currentId?.trim();
  return trimmed ? trimmed : fallbackId;
}
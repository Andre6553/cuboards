/** Distinct left-border accent per unit (stable for a given unit id). */
const UNIT_ACCENT_PALETTE = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#4f46e5',
  '#65a30d',
  '#c026d3',
  '#ea580c',
] as const;

export function unitAccentColor(unitId: string): string {
  let hash = 0;
  for (let i = 0; i < unitId.length; i++) {
    hash = (hash * 31 + unitId.charCodeAt(i)) >>> 0;
  }
  return UNIT_ACCENT_PALETTE[hash % UNIT_ACCENT_PALETTE.length];
}

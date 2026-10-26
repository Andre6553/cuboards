/** Distinct left-border accent per unit (stable for a given unit id). */

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** 50 hues evenly spaced; saturation/lightness alternate so neighbours do not look alike. */
const UNIT_ACCENT_PALETTE = Array.from({ length: 50 }, (_, i) => {
  const h = (i * 360) / 50;
  const s = i % 2 === 0 ? 72 : 58;
  const l = 34 + (i % 5) * 4;
  return hslToHex(h, s, l);
}) as readonly string[];

export function unitAccentColor(unitId: string): string {
  let hash = 0;
  for (let i = 0; i < unitId.length; i++) {
    hash = (hash * 31 + unitId.charCodeAt(i)) >>> 0;
  }
  return UNIT_ACCENT_PALETTE[hash % UNIT_ACCENT_PALETTE.length];
}

/** Number of distinct accent colors before the palette repeats. */
export const UNIT_ACCENT_COLOR_COUNT = UNIT_ACCENT_PALETTE.length;

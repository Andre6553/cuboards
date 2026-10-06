/** Smallest board purchase unit — suppliers sell full sheets or quarter sheets. */
export const SHEET_PURCHASE_FRACTION = 0.25;

/**
 * Estimated sheets to order from total part area.
 * Rounds up to the nearest quarter sheet (¼, ½, ¾, 1, 1¼, …).
 */
export function estimateSheetsFromArea(totalAreaMm2: number, sheetAreaMm2: number): number {
  if (totalAreaMm2 <= 0 || sheetAreaMm2 <= 0) return 0;
  const quarterSteps = Math.ceil((totalAreaMm2 / sheetAreaMm2) * (1 / SHEET_PURCHASE_FRACTION));
  return quarterSteps * SHEET_PURCHASE_FRACTION;
}

/** Human-readable sheet count for cost lines (e.g. "0.25 sheet(s)", "2 sheet(s)"). */
export function formatSheetCount(sheets: number): string {
  if (sheets <= 0) return '0 sheet(s)';
  const text = Number.isInteger(sheets) ? String(sheets) : sheets.toFixed(2).replace(/\.?0+$/, '');
  return `${text} sheet(s)`;
}

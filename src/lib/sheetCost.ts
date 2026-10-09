import type { MasoniteConfig, Material, SheetPurchaseUnit } from '../types';

/** Default when a saved job has no per-board purchase setting. */
export const DEFAULT_SHEET_PURCHASE_UNIT: SheetPurchaseUnit = 'quarter';

export const SHEET_PURCHASE_FRACTION: Record<SheetPurchaseUnit, number> = {
  full: 1,
  half: 0.5,
  quarter: 0.25,
};

export function resolveSheetPurchaseUnit(material: Material): SheetPurchaseUnit {
  return material.sheetPurchaseUnit ?? DEFAULT_SHEET_PURCHASE_UNIT;
}

export function sheetPurchaseFraction(material: Material): number {
  return SHEET_PURCHASE_FRACTION[resolveSheetPurchaseUnit(material)];
}

export function resolveMasonitePurchaseUnit(masonite: MasoniteConfig): SheetPurchaseUnit {
  return masonite.sheetPurchaseUnit ?? DEFAULT_SHEET_PURCHASE_UNIT;
}

export function masonitePurchaseFraction(masonite: MasoniteConfig): number {
  return SHEET_PURCHASE_FRACTION[resolveMasonitePurchaseUnit(masonite)];
}

export function sheetPurchaseDetailLabel(unit: SheetPurchaseUnit): string {
  switch (unit) {
    case 'full':
      return 'full sheet only';
    case 'half':
      return '½-sheet increments';
    case 'quarter':
      return '¼-sheet increments';
  }
}

/**
 * Sheets to order from total part area.
 * Rounds **up** to the next step the supplier allows (¼, ½, or full) so a small
 * overrun (e.g. 1.05 sheets of material) becomes 1.25 when ¼ sheets are sold,
 * not 2 full sheets. "Full sheet only" means any overrun rounds to the next whole sheet.
 */
export function estimateSheetsFromArea(
  totalAreaMm2: number,
  sheetAreaMm2: number,
  purchaseFraction: number = SHEET_PURCHASE_FRACTION.quarter,
): number {
  if (totalAreaMm2 <= 0 || sheetAreaMm2 <= 0 || purchaseFraction <= 0) return 0;
  const steps = Math.ceil((totalAreaMm2 / sheetAreaMm2) * (1 / purchaseFraction));
  return steps * purchaseFraction;
}

/** Human-readable sheet count for cost lines (e.g. "0.25 sheet(s)", "2 sheet(s)"). */
export function formatSheetCount(sheets: number): string {
  if (sheets <= 0) return '0 sheet(s)';
  const text = Number.isInteger(sheets) ? String(sheets) : sheets.toFixed(2).replace(/\.?0+$/, '');
  return `${text} sheet(s)`;
}

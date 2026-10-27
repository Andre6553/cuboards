import type { CostLine } from '../types';

/** Boards, edging, masonite, cut-house cutting/drill — same bucket as Cut and Edge PDF (no Gelmar). */
export const WOOD_MATERIAL_COST_CATEGORIES = ['board', 'edging', 'masonite', 'cutHouse'] as const;

export type WoodMaterialCostCategory = (typeof WOOD_MATERIAL_COST_CATEGORIES)[number];

export function isWoodMaterialCostLine(c: CostLine): boolean {
  return (WOOD_MATERIAL_COST_CATEGORIES as readonly string[]).includes(c.category);
}

export function splitQuoteCostLines(costs: CostLine[]): {
  woodLines: CostLine[];
  hardwareLines: CostLine[];
  woodMaterialTotal: number;
  hardwareTotal: number;
} {
  let woodMaterialTotal = 0;
  let hardwareTotal = 0;
  const woodLines: CostLine[] = [];
  const hardwareLines: CostLine[] = [];
  for (const c of costs) {
    if (c.category === 'hardware') {
      hardwareLines.push(c);
      hardwareTotal += c.subtotal;
    } else if (isWoodMaterialCostLine(c)) {
      woodLines.push(c);
      woodMaterialTotal += c.subtotal;
    }
  }
  return { woodLines, hardwareLines, woodMaterialTotal, hardwareTotal };
}

import { hingesPerDoorLeafForDoor } from './doorRules';
import { resolveFrontLayout } from './frontLayout';
import { isCompleteSupplierName } from './materialSupplierPrices';
import { MASONITE_MATERIAL_ID, resolveOrderSupplierForMaterialId } from './orderSupplier';
import { DEFAULT_CUT_HOUSE_CHARGES } from './constants';
import type { CostLine, CutHouseChargeSettings, Job } from '../types';

export function resolveCutHouseCharges(job: Job): Required<CutHouseChargeSettings> {
  return { ...DEFAULT_CUT_HOUSE_CHARGES, ...job.settings.cutHouseCharges };
}

export function materialUsesCutHouse(job: Job, materialId: string, onlyWhenOrderFromSet: boolean): boolean {
  if (!onlyWhenOrderFromSet) return true;
  const name = resolveOrderSupplierForMaterialId(job, materialId);
  return Boolean(name && isCompleteSupplierName(name));
}

/** Hinge cup holes drilled at cut house (BOOR), when factory hinge holes are enabled. */
export function countFactoryDrillHoles(job: Job): number {
  let total = 0;
  for (const unit of job.units) {
    const mult = Math.max(0, unit.unitQty ?? 0);
    if (mult <= 0) continue;
    const layoutUnit = resolveFrontLayout(unit);
    for (const door of layoutUnit.doors ?? []) {
      if (door.factoryHingeHoles === false) continue;
      const leaves = Math.max(1, door.qty);
      total += mult * leaves * hingesPerDoorLeafForDoor(door);
    }
  }
  return total;
}

export function billableEdgingMetres(
  rawLm: number,
  ch: Required<CutHouseChargeSettings>,
): { billableLm: number; detail: string } {
  const wastage = Math.max(0, ch.edgingOrderWastagePercent);
  let billableLm = rawLm * (1 + wastage / 100);
  if (ch.edgingOrderRoundUpMetre) billableLm = Math.ceil(billableLm);
  if (wastage > 0 || ch.edgingOrderRoundUpMetre) {
    const parts = [`${billableLm.toFixed(2)} m on order`, `${rawLm.toFixed(2)} m on cut list`];
    if (wastage > 0) parts.push(`${wastage}% cut-house edging allowance`);
    return { billableLm, detail: parts.join(' · ') };
  }
  return { billableLm: rawLm, detail: `${rawLm.toFixed(2)} linear metres` };
}

export function appendCutHouseCosts(
  job: Job,
  costs: CostLine[],
  boardSheets: { materialId: string; sheets: number }[],
  masoniteSheets: number,
): void {
  const ch = resolveCutHouseCharges(job);
  const onlyWhen = ch.onlyWhenOrderFromSet;

  const melPrice = ch.melamineCutPricePerSheet;
  if (melPrice > 0) {
    let ops = 0;
    for (const row of boardSheets) {
      if (!materialUsesCutHouse(job, row.materialId, onlyWhen)) continue;
      ops += Math.ceil(row.sheets - 1e-9);
    }
    if (ops > 0) {
      costs.push({
        category: 'cutHouse',
        name: 'Melamine cutting (SMEL)',
        detail: `${ops} sheet cut(s) at cut house — boards only`,
        quantity: ops,
        unitPrice: melPrice,
        subtotal: ops * melPrice,
      });
    }
  }

  const hbPrice = ch.hardboardCutPricePerSheet;
  if (hbPrice > 0 && masoniteSheets > 0 && materialUsesCutHouse(job, MASONITE_MATERIAL_ID, onlyWhen)) {
    costs.push({
      category: 'cutHouse',
      name: 'Hardboard / masonite cutting (SHB)',
      detail: '1 cut batch for masonite backs',
      quantity: 1,
      unitPrice: hbPrice,
      subtotal: hbPrice,
    });
  }

  const drillPrice = ch.factoryDrillPricePerHole;
  if (drillPrice > 0) {
    const holes = countFactoryDrillHoles(job);
    if (holes > 0) {
      costs.push({
        category: 'cutHouse',
        name: 'Factory hinge drill (BOOR)',
        detail: `${holes} hinge cup hole(s) on doors — hardware still from Gelmar`,
        quantity: holes,
        unitPrice: drillPrice,
        subtotal: holes * drillPrice,
      });
    }
  }
}

import { hingesPerDoorLeafForDoor } from './doorRules';
import { resolveFrontLayout } from './frontLayout';
import { isCompleteSupplierName } from './materialSupplierPrices';
import { MASONITE_MATERIAL_ID, resolveOrderSupplierForMaterialId } from './orderSupplier';
import { DEFAULT_CUT_HOUSE_CHARGES } from './constants';
import { quoteLineSubtotal, quoteUnitPrice } from './vat';
import type { CostLine, CutHouseChargeSettings, Job } from '../types';

export function resolveCutHouseCharges(job: Job): Required<CutHouseChargeSettings> {
  return { ...DEFAULT_CUT_HOUSE_CHARGES, ...job.settings.cutHouseCharges };
}

/**
 * True when this job is ordered from a cut house at all (job default, any board
 * Order from, or masonite Order from — including masonite’s inherited dominant board).
 * Used so SMEL can bill every melamine sheet once the job is clearly a cut-house job.
 */
export function jobHasCutHouseOrdering(job: Job): boolean {
  const jobDefault = job.settings.defaultOrderSupplier?.trim() ?? '';
  if (jobDefault && isCompleteSupplierName(jobDefault)) return true;
  for (const m of job.materials) {
    const name = m.orderFromSupplier?.trim() ?? '';
    if (name && isCompleteSupplierName(name)) return true;
  }
  const small = job.masonite.orderFromSupplier?.trim() ?? '';
  if (small && isCompleteSupplierName(small)) return true;
  const large = job.masonite.largeOrderFromSupplier?.trim() ?? '';
  if (large && isCompleteSupplierName(large)) return true;
  const masoniteResolved = resolveOrderSupplierForMaterialId(job, MASONITE_MATERIAL_ID);
  return Boolean(masoniteResolved && isCompleteSupplierName(masoniteResolved));
}

export function materialUsesCutHouse(job: Job, materialId: string, onlyWhenOrderFromSet: boolean): boolean {
  if (!onlyWhenOrderFromSet) return true;
  if (materialId === MASONITE_MATERIAL_ID) {
    // Either sheet size may name a cut house; treat masonite as ordered if any is set.
    const small = job.masonite.orderFromSupplier?.trim() ?? '';
    const large = job.masonite.largeOrderFromSupplier?.trim() ?? '';
    if (small && isCompleteSupplierName(small)) return true;
    if (large && isCompleteSupplierName(large)) return true;
    const name = resolveOrderSupplierForMaterialId(job, materialId);
    return Boolean(name && isCompleteSupplierName(name));
  }
  // Melamine: once the job has any cut-house Order from / default, all boards count for SMEL
  // (avoids missing White/Nordic cuts when only a spare material row has Order from set).
  if (jobHasCutHouseOrdering(job)) return true;
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

/** Masonite sheet count on the client quote (HB001-style full sheet from cut house). */
export function masoniteQuoteSheetCount(
  job: Job,
  computedFullSheetEquiv: number,
  ch: Required<CutHouseChargeSettings>,
): number {
  if (computedFullSheetEquiv <= 0) return 0;
  if (ch.masoniteOneFullSheetFromCutHouse === false) return computedFullSheetEquiv;
  if (!materialUsesCutHouse(job, MASONITE_MATERIAL_ID, ch.onlyWhenOrderFromSet !== false)) {
    return computedFullSheetEquiv;
  }
  return 1;
}

export function appendCutHouseCosts(
  job: Job,
  costs: CostLine[],
  boardSheets: { materialId: string; sheets: number }[],
  masoniteSheets: number,
): void {
  const ch = resolveCutHouseCharges(job);
  const onlyWhen = ch.onlyWhenOrderFromSet;

  const melPrice = quoteUnitPrice(ch.melamineCutPricePerSheet, job.settings);
  if (ch.melamineCutPricePerSheet > 0) {
    let ops = 0;
    for (const row of boardSheets) {
      if (!materialUsesCutHouse(job, row.materialId, onlyWhen)) continue;
      ops += Math.ceil(row.sheets - 1e-9);
    }
    if (ops > 0) {
      costs.push({
        category: 'cutHouse',
        name: 'Melamine cutting (SMEL)',
        detail: `${ops} melamine sheet cut(s) at cut house`,
        quantity: ops,
        unitPrice: melPrice,
        subtotal: quoteLineSubtotal(ops, ch.melamineCutPricePerSheet, job.settings),
      });
    }
  }

  const hbPrice = quoteUnitPrice(ch.hardboardCutPricePerSheet, job.settings);
  if (ch.hardboardCutPricePerSheet > 0 && masoniteSheets > 0 && materialUsesCutHouse(job, MASONITE_MATERIAL_ID, onlyWhen)) {
    // Charge per masonite sheet (same ceil rule as SMEL board cuts).
    const sheetCuts = Math.ceil(masoniteSheets - 1e-9);
    if (sheetCuts > 0) {
      costs.push({
        category: 'cutHouse',
        name: 'Hardboard / masonite cutting (SHB)',
        detail: `${sheetCuts} masonite sheet cut(s) at cut house`,
        quantity: sheetCuts,
        unitPrice: hbPrice,
        subtotal: quoteLineSubtotal(sheetCuts, ch.hardboardCutPricePerSheet, job.settings),
      });
    }
  }

  const drillPrice = quoteUnitPrice(ch.factoryDrillPricePerHole, job.settings);
  if (ch.factoryDrillPricePerHole > 0) {
    const holes = countFactoryDrillHoles(job);
    if (holes > 0) {
      costs.push({
        category: 'cutHouse',
        name: 'Factory hinge drill (BOOR)',
        detail: `${holes} hinge cup hole(s) on doors — hardware still from Gelmar`,
        quantity: holes,
        unitPrice: drillPrice,
        subtotal: quoteLineSubtotal(holes, ch.factoryDrillPricePerHole, job.settings),
      });
    }
  }
}

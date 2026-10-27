import { materialUsesCutHouse, resolveCutHouseCharges } from './cutHouseCharges';
import { inclForCutHouseQuoteUnit, resolvePricesEnterAsInclVat, resolveVatRatePercent } from './vat';
import type { Job, Material } from '../types';

/** Stored unit price for board quote lines (cut-house ex-VAT alignment when enabled). */
export function boardQuoteStoredUnitPrice(m: Material, job: Job): number {
  const incl = m.pricePerSheet;
  if (!resolvePricesEnterAsInclVat(job.settings)) return incl;
  const ch = resolveCutHouseCharges(job);
  const cutHouseActive =
    ch.melamineCutPricePerSheet > 0 ||
    ch.hardboardCutPricePerSheet > 0 ||
    ch.factoryDrillPricePerHole > 0;
  if (!cutHouseActive || !materialUsesCutHouse(job, m.id, ch.onlyWhenOrderFromSet !== false)) {
    return incl;
  }
  return inclForCutHouseQuoteUnit(incl, resolveVatRatePercent(job.settings));
}

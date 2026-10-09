import type { Job, ScrewLine } from '../types';
import {
  CONNECTING_FITTING_CATALOG,
  CONNECTING_FITTING_ID_CORNER_BLOCK,
  getConnectingFittingById,
} from './connectingFittingCatalog';
import { calcCustomPackLines, usesGelmarCatalog } from './hardwarePricing';

/** Corner blocks with cap — per cupboard. */
export const DEFAULT_CONNECTING_FITTING_USAGE = {
  cornerBlockPerCupboard: 8,
} as const;

/** Job-wide connecting fitting totals. */
export function calcJobConnectingFittings(job: Job): ScrewLine[] {
  if (!usesGelmarCatalog(job, 'connectingFittings')) {
    return calcCustomPackLines(job, 'connectingFittings');
  }

  let totalPieces = 0;
  for (const unit of job.units) {
    const cupboards = Math.max(0, unit.unitQty ?? 0);
    if (cupboards <= 0) continue;
    totalPieces += DEFAULT_CONNECTING_FITTING_USAGE.cornerBlockPerCupboard * cupboards;
  }

  if (totalPieces <= 0) return [];

  const entry = CONNECTING_FITTING_CATALOG.find((f) => f.id === CONNECTING_FITTING_ID_CORNER_BLOCK);
  if (!entry) return [];

  const packsNeeded = Math.ceil(totalPieces / entry.packSize);
  const packPrice = job.connectingFittingPrices?.[entry.id] ?? entry.defaultPackPrice;

  return [
    {
      screwId: entry.id,
      name: entry.name,
      sku: entry.sku,
      totalScrews: totalPieces,
      packSize: entry.packSize,
      packsNeeded,
      packPrice,
      subtotal: packsNeeded * packPrice,
      usageDetail: `${DEFAULT_CONNECTING_FITTING_USAGE.cornerBlockPerCupboard}/cupboard`,
    },
  ];
}

export function connectingFittingLineDetail(line: ScrewLine): string {
  const entry = getConnectingFittingById(line.screwId);
  const dims =
    entry?.lengthMm && entry?.widthMm && entry?.heightMm
      ? ` · ${entry.lengthMm}×${entry.widthMm}×${entry.heightMm} mm`
      : '';
  return (
    `${line.totalScrews} pieces (${line.usageDetail}) · ` +
    `${line.packsNeeded} pack(s) of ${line.packSize}${dims}` +
    (line.sku ? ` · SKU ${line.sku}` : '')
  );
}

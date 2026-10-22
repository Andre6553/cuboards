import type { Job, ScrewLine } from '../types';
import {
  CONNECTING_FITTING_CATALOG,
  CONNECTING_FITTING_ID_CORNER_BLOCK,
  getConnectingFittingById,
} from './connectingFittingCatalog';
import { cornerBlockUsageDetail, totalCornerBlocksOnJob } from './cornerBlockRules';
import { calcCustomPackLines, usesGelmarCatalog } from './hardwarePricing';

/** 4×16 mm chipboard screws per corner block (Gelmar 4386). */
export const SCREWS_PER_CORNER_BLOCK = 4;

/** Job-wide connecting fitting totals. */
export function calcJobConnectingFittings(job: Job): ScrewLine[] {
  if (!usesGelmarCatalog(job, 'connectingFittings')) {
    return calcCustomPackLines(job, 'connectingFittings');
  }

  const totalPieces = totalCornerBlocksOnJob(job);
  if (totalPieces <= 0) return [];

  const entry = CONNECTING_FITTING_CATALOG.find((f) => f.id === CONNECTING_FITTING_ID_CORNER_BLOCK);
  if (!entry) return [];

  const packsNeeded = Math.ceil(totalPieces / entry.packSize);
  const packPrice = job.connectingFittingPrices?.[entry.id] ?? entry.defaultPackPrice;

  const usageParts: string[] = [];
  const materials = job.materials ?? [];
  for (const unit of job.units) {
    const cupboards = Math.max(0, unit.unitQty ?? 0);
    if (cupboards <= 0) continue;
    const detail = cornerBlockUsageDetail(unit, materials);
    if (detail.startsWith('No visible')) continue;
    usageParts.push(`${unit.name}${cupboards > 1 ? ` ×${cupboards}` : ''}: ${detail}`);
  }

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
      usageDetail: usageParts.length > 0 ? usageParts.join(' · ') : 'From shelves, fillers & visible sides',
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

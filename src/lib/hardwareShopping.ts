import type { CutListResult, HardwareItem, Job, ScrewLine } from '../types';
import { GELMAR_CABINET_FOOT } from './footCatalog';
import { HINGE_CATALOG } from './hingeCatalog';
import { RUNNER_CATALOG } from './runnerCatalog';
import { getConnectingFittingById } from './connectingFittingCatalog';
import { getScrewById } from './screwCatalog';
import { gelmarCatalogSearchUrl } from './gelmarProductImage';
import { GELMAR_PLINTH_CORNER_PRODUCTS, gelmarKickplateProduct } from './gelmarKickplateCatalog';
import { requireUserDataScope, userStorageKeys } from './userDataScope';

function plinthCornerBySku(sku: string) {
  if (!sku) return undefined;
  return Object.values(GELMAR_PLINTH_CORNER_PRODUCTS).find((p) => p.sku === sku);
}

export type HardwareShoppingQtyUnit = 'each' | 'pair' | 'pack';

export interface HardwareShoppingItem {
  id: string;
  description: string;
  sku: string;
  supplier: string;
  qty: number;
  qtyUnit: HardwareShoppingQtyUnit;
  notes: string;
  /** Job quote money for this consolidated shopping line. */
  subtotal: number;
  url?: string;
  imageUrl?: string;
}

const SKU_RE = /\bSKU\s+([A-Za-z0-9-]+)/i;

export function parseSkuFromText(text: string): string {
  const m = text.match(SKU_RE);
  return m?.[1]?.trim() ?? '';
}

function hingeBySku(sku: string) {
  if (!sku) return undefined;
  return HINGE_CATALOG.find((h) => h.sku === sku);
}

function runnerBySku(sku: string) {
  if (!sku) return undefined;
  return RUNNER_CATALOG.find((r) => r.sku === sku);
}

function supplierForHardware(
  h: HardwareItem,
  sku: string,
): { supplier: string; url?: string; sku: string; imageUrl?: string } {
  const desc = h.description.toLowerCase();
  if (desc.includes('foot') || desc.includes('kitchen leg')) {
    return {
      supplier: 'Gelmar',
      sku: sku || GELMAR_CABINET_FOOT.sku,
      url: GELMAR_CABINET_FOOT.url,
      imageUrl: GELMAR_CABINET_FOOT.imageUrl,
    };
  }
  const corner =
    plinthCornerBySku(sku) ||
    (desc.includes('plinth corner')
      ? Object.values(GELMAR_PLINTH_CORNER_PRODUCTS).find((p) =>
          h.description.includes(`${p.heightMm}mm`) || h.description.includes(`${p.heightMm} mm`),
        )
      : undefined);
  if (corner) {
    return {
      supplier: 'Gelmar',
      sku: corner.sku,
      url: corner.url,
      imageUrl: corner.imageUrl,
    };
  }
  const hinge = hingeBySku(sku);
  if (hinge) {
    return { supplier: 'Gelmar', sku: hinge.sku ?? sku, url: hinge.url, imageUrl: hinge.imageUrl };
  }
  const runner = runnerBySku(sku);
  if (runner) {
    return {
      supplier: runner.source === 'gelmar' ? 'Gelmar' : runner.name.split(/\s+/)[0] || 'Brand hardware',
      sku: runner.sku ?? sku,
      url: runner.url,
      imageUrl: runner.imageUrl,
    };
  }
  if (sku) return { supplier: 'Gelmar', sku, url: gelmarCatalogSearchUrl(sku) };
  if (h.detail.toLowerCase().includes('custom')) return { supplier: 'Custom / other', sku: '' };
  return { supplier: 'Hardware store', sku: sku };
}

function notesWithoutSku(detail: string): string {
  return detail.replace(/\s*·\s*SKU\s+[A-Za-z0-9-]+/gi, '').replace(/\s{2,}/g, ' ').trim();
}

function makeId(supplier: string, sku: string, description: string, notes: string): string {
  return [supplier, sku || '', description, notes].join('|');
}

function addOrMerge(map: Map<string, HardwareShoppingItem>, item: Omit<HardwareShoppingItem, 'id'>): void {
  const id = makeId(item.supplier, item.sku, item.description, item.notes);
  const existing = map.get(id);
  if (existing) {
    existing.qty += item.qty;
    existing.subtotal += item.subtotal;
    if (!existing.imageUrl && item.imageUrl) existing.imageUrl = item.imageUrl;
    return;
  }
  map.set(id, { ...item, id });
}

function fromHardwareLine(h: HardwareItem): Omit<HardwareShoppingItem, 'id'> | null {
  if (h.description === 'Plastic kickplate strip') return null;
  if (h.qty <= 0) return null;
  const skuFromText = parseSkuFromText(h.detail);
  const { supplier, sku, url, imageUrl } = supplierForHardware(h, skuFromText);
  const isPair = h.description.toLowerCase().includes('runner');
  const notes = notesWithoutSku(h.detail);
  return {
    description: h.description,
    sku,
    supplier,
    qty: h.qty,
    qtyUnit: isPair ? 'pair' : 'each',
    notes,
    subtotal: h.subtotal,
    url,
    imageUrl,
  };
}

function fromScrewLine(s: ScrewLine, kind: 'screw' | 'fitting'): Omit<HardwareShoppingItem, 'id'> | null {
  if (s.packsNeeded <= 0) return null;
  const screw = getScrewById(s.screwId);
  const fitting = getConnectingFittingById(s.screwId);
  const sku = s.sku || screw?.sku || fitting?.sku || '';
  const url = screw?.url || fitting?.url || (sku ? gelmarCatalogSearchUrl(sku) : undefined);
  const notes =
    kind === 'fitting'
      ? `Pack of ${s.packSize}${s.usageDetail ? ` · ${s.usageDetail}` : ''}`
      : `${s.totalScrews} screws · pack of ${s.packSize}${s.usageDetail ? ` · ${s.usageDetail}` : ''}`;
  return {
    description: s.name,
    sku,
    supplier: sku || screw || fitting ? 'Gelmar' : 'Hardware store',
    qty: s.packsNeeded,
    qtyUnit: 'pack',
    notes,
    subtotal: s.subtotal,
    url,
    imageUrl: screw?.imageUrl || fitting?.imageUrl,
  };
}

/** Job hardware for store shopping — consolidated by product (SKU / description), not per cupboard. */
export function buildHardwareShoppingList(job: Job, result: CutListResult): HardwareShoppingItem[] {
  const map = new Map<string, HardwareShoppingItem>();
  for (const h of result.hardware) {
    const row = fromHardwareLine(h);
    if (row) addOrMerge(map, row);
  }
  for (const s of result.screws) {
    const isFitting = /corner|fitting|block/i.test(s.name) || Boolean(getConnectingFittingById(s.screwId));
    const row = fromScrewLine(s, isFitting ? 'fitting' : 'screw');
    if (row) addOrMerge(map, row);
  }
  // Whole 3 m PVC/Gelmar strips (same rounding as quote costs).
  for (const p of result.plasticKickplatePurchases ?? []) {
    if (p.stripsToBuy <= 0) continue;
    const gelmarOn = job.plasticKickplate.useGelmarCatalog !== false;
    const gelmar = gelmarOn ? gelmarKickplateProduct(p.stripHeight) : null;
    const sku = gelmar?.sku ?? '';
    addOrMerge(map, {
      description: `${p.productName} · ${p.stripHeight}×${p.stripWidth} mm`,
      sku,
      supplier: gelmarOn ? 'Gelmar' : 'Hardware store',
      qty: p.stripsToBuy,
      qtyUnit: 'each',
      notes: `${p.neededMetres.toFixed(2)} m needed · buy ${p.stripsToBuy} × 3 m strip${p.stripsToBuy === 1 ? '' : 's'}`,
      subtotal: p.subtotal,
      url: gelmar?.url,
      imageUrl: gelmar?.imageUrl,
    });
  }
  const items = [...map.values()].sort((a, b) => {
    const s = a.supplier.localeCompare(b.supplier);
    if (s !== 0) return s;
    return a.description.localeCompare(b.description);
  });
  return items;
}

export function hardwareShoppingGrandTotal(items: HardwareShoppingItem[]): number {
  return items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
}

export function formatShoppingQty(item: HardwareShoppingItem): string {
  const n = item.qty % 1 === 0 ? String(item.qty) : item.qty.toFixed(2).replace(/\.?0+$/, '');
  if (item.qtyUnit === 'pair') return `${n} pair${item.qty === 1 ? '' : 's'}`;
  if (item.qtyUnit === 'pack') return `${n} pack${item.qty === 1 ? '' : 's'}`;
  return `${n} each`;
}

export function groupShoppingBySupplier(items: HardwareShoppingItem[]): { supplier: string; items: HardwareShoppingItem[] }[] {
  const order: string[] = [];
  const by = new Map<string, HardwareShoppingItem[]>();
  for (const item of items) {
    if (!by.has(item.supplier)) {
      order.push(item.supplier);
      by.set(item.supplier, []);
    }
    by.get(item.supplier)!.push(item);
  }
  return order.map((supplier) => ({ supplier, items: by.get(supplier)! }));
}

type TickMap = Record<string, Record<string, boolean>>;

function loadAllTicks(): TickMap {
  try {
    requireUserDataScope();
    const raw = localStorage.getItem(userStorageKeys.hardwareShoppingTicks());
    if (!raw) return {};
    return JSON.parse(raw) as TickMap;
  } catch {
    return {};
  }
}

export function loadHardwareShoppingTicks(jobId: string): Record<string, boolean> {
  return loadAllTicks()[jobId] ?? {};
}

export function saveHardwareShoppingTicks(jobId: string, ticks: Record<string, boolean>): void {
  try {
    requireUserDataScope();
    const all = loadAllTicks();
    all[jobId] = ticks;
    localStorage.setItem(userStorageKeys.hardwareShoppingTicks(), JSON.stringify(all));
  } catch {
    /* unsigned / tests */
  }
}

export function remainingShoppingItems(
  items: HardwareShoppingItem[],
  ticks: Record<string, boolean>,
): HardwareShoppingItem[] {
  return items.filter((i) => !ticks[i.id]);
}
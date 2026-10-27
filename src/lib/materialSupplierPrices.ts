import type { Material, MaterialSupplierPrice } from '../types';

export function normalizeSupplierName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Ignore partial names while typing so dropdowns are not polluted (e.g. "G" → "Gelmar"). */
export const SUPPLIER_NAME_MIN_LENGTH = 3;

export function isCompleteSupplierName(name: string): boolean {
  return normalizeSupplierName(name).length >= SUPPLIER_NAME_MIN_LENGTH;
}

/** Unique supplier names from board rows (sorted A–Z). */
export function extractSupplierNamesFromMaterials(materials: Material[]): string[] {
  const seen = new Map<string, string>();
  for (const m of materials) {
    for (const s of m.supplierPrices ?? []) {
      const n = normalizeSupplierName(s.supplierName);
      if (!n || !isCompleteSupplierName(n)) continue;
      const key = n.toLowerCase();
      if (!seen.has(key)) seen.set(key, n);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function compactSupplierKey(name: string): string {
  return normalizeSupplierName(name).toLowerCase().replace(/\s+/g, '');
}

function mergeSupplierNameListsRaw(...lists: ((string | undefined)[] | undefined)[]): string[] {
  const seen = new Map<string, string>();
  for (const list of lists) {
    for (const raw of list ?? []) {
      if (raw == null) continue;
      const n = normalizeSupplierName(raw);
      if (!n || !isCompleteSupplierName(n)) continue;
      const key = n.toLowerCase();
      if (!seen.has(key)) seen.set(key, n);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Drop keystroke debris (Gar, Garden R, …) when a longer name shares the same prefix. */
export function pruneIncrementalSupplierNames(names: string[]): string[] {
  const list = mergeSupplierNameListsRaw(names);
  const withoutPrefixJunk = list.filter((name) => {
    const compact = compactSupplierKey(name);
    if (!/^[\p{L}\p{N}\s&'.-]+$/u.test(name)) return false;
    return !list.some((other) => {
      if (other === name) return false;
      const oc = compactSupplierKey(other);
      return oc.length > compact.length && oc.startsWith(compact);
    });
  });
  const byCompact = new Map<string, string>();
  for (const n of withoutPrefixJunk) {
    const c = compactSupplierKey(n);
    const prev = byCompact.get(c);
    if (!prev) byCompact.set(c, n);
    else if (n.includes(' ') && !prev.includes(' ')) byCompact.set(c, n);
    else if (n.length > prev.length) byCompact.set(c, n);
  }
  return [...byCompact.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function mergeSupplierNameLists(...lists: ((string | undefined)[] | undefined)[]): string[] {
  return pruneIncrementalSupplierNames(mergeSupplierNameListsRaw(...lists));
}

export function supplierNameInList(knownNames: string[], name: string): boolean {
  const key = normalizeSupplierName(name).toLowerCase();
  if (!key || !isCompleteSupplierName(name)) return false;
  return knownNames.some((k) => k.toLowerCase() === key);
}

export function canonicalSupplierName(knownNames: string[], name: string): string {
  const key = normalizeSupplierName(name).toLowerCase();
  const hit = knownNames.find((k) => k.toLowerCase() === key);
  return hit ?? normalizeSupplierName(name);
}

export function normalizeMaterialSuppliers(m: Material): Material {
  const supplierPrices = (m.supplierPrices ?? []).map((s) => ({
    id: s.id,
    supplierName: s.supplierName ?? '',
    pricePerSheet: Math.max(0, Number(s.pricePerSheet) || 0),
  }));
  let quotePriceSource = m.quotePriceSource ?? 'manual';
  if (quotePriceSource !== 'manual' && !supplierPrices.some((s) => s.id === quotePriceSource)) {
    quotePriceSource = 'manual';
  }
  return { ...m, supplierPrices, quotePriceSource };
}

export function addMaterialSupplierRow(m: Material): Material {
  const base = normalizeMaterialSuppliers(m);
  const row: MaterialSupplierPrice = {
    id: crypto.randomUUID(),
    supplierName: '',
    pricePerSheet: base.pricePerSheet,
  };
  return { ...base, supplierPrices: [...(base.supplierPrices ?? []), row] };
}

export function updateMaterialSupplier(
  m: Material,
  supplierId: string,
  patch: Partial<Pick<MaterialSupplierPrice, 'supplierName' | 'pricePerSheet'>>,
): Material {
  const base = normalizeMaterialSuppliers(m);
  const supplierPrices = (base.supplierPrices ?? []).map((s) =>
    s.id === supplierId ? { ...s, ...patch, pricePerSheet: patch.pricePerSheet ?? s.pricePerSheet } : s,
  );
  let next: Material = { ...base, supplierPrices };
  if (base.quotePriceSource === supplierId && patch.pricePerSheet != null) {
    next = { ...next, pricePerSheet: Math.max(0, patch.pricePerSheet) };
  }
  if (base.quotePriceSource === supplierId && patch.supplierName != null) {
    const name = normalizeSupplierName(patch.supplierName);
    if (name && isCompleteSupplierName(name)) {
      next = { ...next, orderFromSupplier: name };
    }
  }
  return next;
}

export function removeMaterialSupplier(m: Material, supplierId: string): Material {
  const base = normalizeMaterialSuppliers(m);
  const supplierPrices = (base.supplierPrices ?? []).filter((s) => s.id !== supplierId);
  let quotePriceSource = base.quotePriceSource;
  if (quotePriceSource === supplierId) quotePriceSource = 'manual';
  return { ...base, supplierPrices, quotePriceSource };
}

/** Cut-house picker: also drives quote price when that supplier has a stored sheet price. */
export function setMaterialOrderFromSupplier(m: Material, supplierName: string | undefined): Material {
  const base = normalizeMaterialSuppliers(m);
  if (!supplierName?.trim()) {
    return { ...base, orderFromSupplier: undefined };
  }
  const orderFromSupplier = normalizeSupplierName(supplierName);
  const row = (base.supplierPrices ?? []).find(
    (s) => normalizeSupplierName(s.supplierName).toLowerCase() === orderFromSupplier.toLowerCase(),
  );
  if (row && isCompleteSupplierName(orderFromSupplier)) {
    return setMaterialQuoteFromSupplier(base, row.id);
  }
  return { ...base, orderFromSupplier };
}

export function setMaterialQuoteFromSupplier(m: Material, supplierId: string): Material {
  const base = normalizeMaterialSuppliers(m);
  const row = (base.supplierPrices ?? []).find((s) => s.id === supplierId);
  if (!row) return base;
  const supplierName = normalizeSupplierName(row.supplierName);
  return {
    ...base,
    quotePriceSource: supplierId,
    pricePerSheet: row.pricePerSheet,
    ...(supplierName && isCompleteSupplierName(supplierName)
      ? { orderFromSupplier: supplierName }
      : {}),
  };
}

export function setMaterialQuoteManual(m: Material, pricePerSheet: number): Material {
  return {
    ...normalizeMaterialSuppliers(m),
    quotePriceSource: 'manual',
    pricePerSheet: Math.max(0, pricePerSheet),
  };
}

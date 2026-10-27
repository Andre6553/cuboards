import type { Material, MaterialSupplierPrice } from '../types';

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
  return next;
}

export function removeMaterialSupplier(m: Material, supplierId: string): Material {
  const base = normalizeMaterialSuppliers(m);
  const supplierPrices = (base.supplierPrices ?? []).filter((s) => s.id !== supplierId);
  let quotePriceSource = base.quotePriceSource;
  if (quotePriceSource === supplierId) quotePriceSource = 'manual';
  return { ...base, supplierPrices, quotePriceSource };
}

export function setMaterialQuoteFromSupplier(m: Material, supplierId: string): Material {
  const base = normalizeMaterialSuppliers(m);
  const row = (base.supplierPrices ?? []).find((s) => s.id === supplierId);
  if (!row) return base;
  return {
    ...base,
    quotePriceSource: supplierId,
    pricePerSheet: row.pricePerSheet,
  };
}

export function setMaterialQuoteManual(m: Material, pricePerSheet: number): Material {
  return {
    ...normalizeMaterialSuppliers(m),
    quotePriceSource: 'manual',
    pricePerSheet: Math.max(0, pricePerSheet),
  };
}

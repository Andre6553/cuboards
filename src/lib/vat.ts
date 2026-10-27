import type { JobSettings } from '../types';

export const DEFAULT_VAT_RATE_PERCENT = 15;

export function resolveVatRatePercent(settings: JobSettings): number {
  const rate = settings.vatRatePercent ?? DEFAULT_VAT_RATE_PERCENT;
  return Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_VAT_RATE_PERCENT;
}

export function resolveShowVatOnQuote(settings: JobSettings): boolean {
  return settings.showVatOnQuote !== false;
}

/** When true, all unit prices in Materials & hardware are treated as VAT-inclusive. */
export function resolvePricesEnterAsInclVat(settings: JobSettings): boolean {
  return settings.pricesEnterAsInclVat === true;
}

/** Incl-VAT rands → ex-VAT cents (integer math avoids JS float bugs e.g. 1449/1.15 → 1260). */
export function inclToExCents(incl: number, ratePercent: number): number {
  const inclCents = Math.round(incl * 100);
  const multiplier = 100 + Math.max(0, ratePercent);
  return Math.round((inclCents * 100) / multiplier);
}

/** Ex-VAT cents → incl-VAT rands (2 dp). */
export function exCentsToIncl(exCents: number, ratePercent: number): number {
  const multiplier = 100 + Math.max(0, ratePercent);
  return Math.round((exCents * multiplier) / 100) / 100;
}

/** Round-trip incl → ex (2 dp) → incl so totals match supplier ex-VAT quotes (e.g. cut house PDF). */
export function normalizeInclUnitPrice(incl: number, ratePercent: number): number {
  return exCentsToIncl(inclToExCents(incl, ratePercent), ratePercent);
}

/** Unit price used on quote cost lines (normalizes when prices are entered incl VAT). */
export function quoteUnitPrice(storedUnitPrice: number, settings: JobSettings): number {
  if (!resolvePricesEnterAsInclVat(settings)) return storedUnitPrice;
  return normalizeInclUnitPrice(storedUnitPrice, resolveVatRatePercent(settings));
}

/** Ex-VAT unit (2 dp) — matches cut-house quote line unit prices when entered incl VAT. */
export function quoteUnitPriceExVat(storedUnitPrice: number, settings: JobSettings): number {
  if (!resolvePricesEnterAsInclVat(settings)) return storedUnitPrice;
  return inclToExCents(storedUnitPrice, resolveVatRatePercent(settings)) / 100;
}

/**
 * Cut-house PDFs use ex-VAT unit prices (e.g. R 1 259,13). Incl prices typed as R 1 449
 * VAT-back-calc to a whole-rand ex (R 1 260); nudge incl by R 1 when that happens.
 */
export function inclForCutHouseQuoteUnit(incl: number, ratePercent: number): number {
  const rate = Math.max(0, ratePercent);
  const exC = inclToExCents(incl, rate);
  if (exC % 100 !== 0 || exC < 10_000) return normalizeInclUnitPrice(incl, rate);
  const nudgedExC = inclToExCents(incl - 1, rate);
  if (nudgedExC % 100 === 0) return normalizeInclUnitPrice(incl, rate);
  return exCentsToIncl(nudgedExC, rate);
}

/** Line subtotal in entered price terms; incl-VAT jobs use ex-VAT line math like supplier quotes. */
export function quoteLineSubtotal(qty: number, storedUnitPrice: number, settings: JobSettings): number {
  if (!resolvePricesEnterAsInclVat(settings)) return qty * storedUnitPrice;
  const rate = resolveVatRatePercent(settings);
  const exUnit = quoteUnitPriceExVat(storedUnitPrice, settings);
  const exLineCents = Math.round(qty * exUnit * 100);
  return exCentsToIncl(exLineCents, rate);
}

export interface VatTotals {
  subtotalExVat: number;
  vatAmount: number;
  totalInclVat: number;
  ratePercent: number;
}

/** Sum of line items when entered prices are ex VAT. */
export function calcVatTotals(subtotalExVat: number, ratePercent: number): VatTotals {
  const rate = Math.max(0, ratePercent);
  const vatAmount = subtotalExVat * (rate / 100);
  return {
    subtotalExVat,
    vatAmount,
    totalInclVat: subtotalExVat + vatAmount,
    ratePercent: rate,
  };
}

/**
 * `grandTotal` is the calculator sum using your entered unit prices.
 * Ex VAT entry → add VAT for client totals; incl VAT entry → extract ex VAT + VAT portion.
 */
export function calcVatTotalsForJob(grandTotal: number, settings: JobSettings): VatTotals {
  const rate = resolveVatRatePercent(settings);
  if (resolvePricesEnterAsInclVat(settings)) {
    const divisor = 1 + rate / 100;
    const subtotalExVat = grandTotal / divisor;
    const vatAmount = grandTotal - subtotalExVat;
    return {
      subtotalExVat,
      vatAmount,
      totalInclVat: grandTotal,
      ratePercent: rate,
    };
  }
  return calcVatTotals(grandTotal, rate);
}

export function formatVatLine(totals: VatTotals): string {
  return `Subtotal ex VAT ${totals.subtotalExVat.toFixed(2)} + VAT (${totals.ratePercent}%) ${totals.vatAmount.toFixed(2)} = ${totals.totalInclVat.toFixed(2)} incl VAT`;
}

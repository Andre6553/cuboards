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

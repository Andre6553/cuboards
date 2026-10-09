import type { JobSettings } from '../types';

export const DEFAULT_VAT_RATE_PERCENT = 15;

export function resolveVatRatePercent(settings: JobSettings): number {
  const rate = settings.vatRatePercent ?? DEFAULT_VAT_RATE_PERCENT;
  return Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_VAT_RATE_PERCENT;
}

export function resolveShowVatOnQuote(settings: JobSettings): boolean {
  return settings.showVatOnQuote !== false;
}

export interface VatTotals {
  subtotalExVat: number;
  vatAmount: number;
  totalInclVat: number;
  ratePercent: number;
}

/** All Cuboards line totals are ex VAT; VAT is added for client-facing quotes. */
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

export function formatVatLine(totals: VatTotals): string {
  return `Subtotal ex VAT ${totals.subtotalExVat.toFixed(2)} + VAT (${totals.ratePercent}%) ${totals.vatAmount.toFixed(2)} = ${totals.totalInclVat.toFixed(2)} incl VAT`;
}

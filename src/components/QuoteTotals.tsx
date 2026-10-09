import { calcVatTotals, resolveShowVatOnQuote, resolveVatRatePercent } from '../lib/vat';
import type { JobSettings } from '../types';

interface Props {
  settings: JobSettings;
  grandTotalExVat: number;
  compact?: boolean;
}

export function QuoteTotalsRows({ settings, grandTotalExVat, compact }: Props) {
  const showVat = resolveShowVatOnQuote(settings);
  const vat = calcVatTotals(grandTotalExVat, resolveVatRatePercent(settings));

  if (!showVat) {
    return (
      <div className={`cost-row total${compact ? ' cost-row-compact' : ''}`}>
        <span></span>
        <span>Grand total (ex VAT)</span>
        <span></span>
        <span>R {grandTotalExVat.toFixed(2)}</span>
      </div>
    );
  }

  return (
    <>
      <div className="cost-row subtotal">
        <span></span>
        <span>Subtotal ex VAT</span>
        <span></span>
        <span>R {vat.subtotalExVat.toFixed(2)}</span>
      </div>
      <div className="cost-row subtotal">
        <span></span>
        <span>VAT ({vat.ratePercent}%)</span>
        <span></span>
        <span>R {vat.vatAmount.toFixed(2)}</span>
      </div>
      <div className="cost-row total">
        <span></span>
        <span>Total incl VAT</span>
        <span></span>
        <span>R {vat.totalInclVat.toFixed(2)}</span>
      </div>
    </>
  );
}

export function formatGrandTotalLabel(settings: JobSettings): string {
  return resolveShowVatOnQuote(settings) ? 'Total incl VAT' : 'Grand total (ex VAT)';
}

export function displayGrandTotal(settings: JobSettings, grandTotalExVat: number): number {
  if (!resolveShowVatOnQuote(settings)) return grandTotalExVat;
  return calcVatTotals(grandTotalExVat, resolveVatRatePercent(settings)).totalInclVat;
}

import { formatMoney } from '../lib/currency';
import { calcVatTotalsForJob, resolvePricesEnterAsInclVat, resolveShowVatOnQuote } from '../lib/vat';
import type { JobSettings } from '../types';

interface Props {
  settings: JobSettings;
  /** Calculator grand total (ex or incl VAT depending on job setting). */
  grandTotal: number;
  compact?: boolean;
}

export function QuoteTotalsRows({ settings, grandTotal, compact }: Props) {
  const showVat = resolveShowVatOnQuote(settings);
  const vat = calcVatTotalsForJob(grandTotal, settings);

  if (!showVat) {
    return (
      <div className={`cost-row total${compact ? ' cost-row-compact' : ''}`}>
        <span></span>
        <span>{formatGrandTotalLabel(settings)}</span>
        <span></span>
        <span>{formatMoney(grandTotal, settings)}</span>
      </div>
    );
  }

  return (
    <>
      <div className="cost-row subtotal">
        <span></span>
        <span>Subtotal ex VAT</span>
        <span></span>
        <span>{formatMoney(vat.subtotalExVat, settings)}</span>
      </div>
      <div className="cost-row subtotal">
        <span></span>
        <span>VAT ({vat.ratePercent}%)</span>
        <span></span>
        <span>{formatMoney(vat.vatAmount, settings)}</span>
      </div>
      <div className="cost-row total">
        <span></span>
        <span>Total incl VAT</span>
        <span></span>
        <span>{formatMoney(vat.totalInclVat, settings)}</span>
      </div>
    </>
  );
}

export function formatGrandTotalLabel(settings: JobSettings): string {
  if (resolveShowVatOnQuote(settings)) return 'Total incl VAT';
  return resolvePricesEnterAsInclVat(settings) ? 'Grand total (incl VAT)' : 'Grand total (ex VAT)';
}

export function displayGrandTotal(settings: JobSettings, grandTotal: number): number {
  if (!resolveShowVatOnQuote(settings)) return grandTotal;
  return calcVatTotalsForJob(grandTotal, settings).totalInclVat;
}

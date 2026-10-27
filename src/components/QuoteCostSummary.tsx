import { formatMoney } from '../lib/currency';
import { splitQuoteCostLines } from '../lib/costSummaryGroups';
import type { CutListResult, JobSettings } from '../types';
import { QuoteTotalsRows } from './QuoteTotals';

interface Props {
  settings: JobSettings;
  result: CutListResult;
  fmt: (n: number) => string;
}

export function QuoteCostSummary({ settings, result, fmt }: Props) {
  const { woodLines, hardwareLines } = splitQuoteCostLines(result.costs);

  return (
    <div className="cost-summary cost-summary-wide">
      <h4 className="cost-summary-group-title">Wood material</h4>
      <p className="hint cost-summary-group-hint">
        Boards, masonite, edging, cut-house cutting and hinge drilling — like a Cut and Edge quote (no Gelmar hardware).
      </p>
      {woodLines.length === 0 ? (
        <p className="hint">No wood material lines yet.</p>
      ) : (
        woodLines.map((c, i) => (
          <div key={`wood-${i}`} className="cost-row">
            <span className="cost-cat">{c.category}</span>
            <span>{c.name}</span>
            <span className="cost-detail">{c.detail}</span>
            <span>{fmt(c.subtotal)}</span>
          </div>
        ))
      )}
      <div className="cost-row subtotal cost-summary-group-total">
        <span></span>
        <span>Wood material total</span>
        <span></span>
        <span>{fmt(result.woodMaterialTotal)}</span>
      </div>

      <h4 className="cost-summary-group-title">Hardware</h4>
      <p className="hint cost-summary-group-hint">Hinges, runners, screws and fittings from Gelmar (or your catalog).</p>
      {hardwareLines.length === 0 ? (
        <p className="hint">No hardware on this job.</p>
      ) : (
        hardwareLines.map((c, i) => (
          <div key={`hw-${i}`} className="cost-row">
            <span className="cost-cat">{c.category}</span>
            <span>{c.name}</span>
            <span className="cost-detail">{c.detail}</span>
            <span>{fmt(c.subtotal)}</span>
          </div>
        ))
      )}
      <div className="cost-row subtotal cost-summary-group-total">
        <span></span>
        <span>Hardware total</span>
        <span></span>
        <span>{fmt(result.hardwareTotal)}</span>
      </div>

      <div className="cost-row subtotal">
        <span className="cost-cat">install</span>
        <span>Installation cost total</span>
        <span className="cost-detail">
          {result.install
            ? `${result.install.lines.length} unit(s)${result.install.minimumApplied > 0 ? ' · min job applied' : ''}`
            : 'Not included'}
        </span>
        <span>{fmt(result.installationTotal)}</span>
      </div>
      <div className="cost-row subtotal">
        <span></span>
        <span>Travel total</span>
        <span></span>
        <span>{fmt(result.travelTotal)}</span>
      </div>

      <QuoteTotalsRows settings={settings} grandTotal={result.grandTotal} />
    </div>
  );
}

/** Compact totals for client quote tab (wood / hardware / grand). */
export function QuoteCostSummaryCompact({ settings, result }: Pick<Props, 'settings' | 'result'>) {
  return (
    <div className="cost-summary cost-summary-wide quote-total-only">
      <div className="cost-row subtotal">
        <span></span>
        <span>Wood material total</span>
        <span></span>
        <span>{formatMoney(result.woodMaterialTotal, settings)}</span>
      </div>
      <div className="cost-row subtotal">
        <span></span>
        <span>Hardware total</span>
        <span></span>
        <span>{formatMoney(result.hardwareTotal, settings)}</span>
      </div>
      <QuoteTotalsRows settings={settings} grandTotal={result.grandTotal} compact />
    </div>
  );
}

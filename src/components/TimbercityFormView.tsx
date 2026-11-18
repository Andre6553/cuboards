import type { CutPiece, Job } from '../types';
import {
  buildTimbercityFormPages,
  timbercityPageLabel,
  type TimbercityFormPage,
} from '../lib/timbercityCutList';

interface Props {
  job: Job;
  pieces: CutPiece[];
}

function TickBox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className={`timbercity-tickbox ${checked ? 'is-checked' : ''}`}>
      <span className="timbercity-tickbox-box" aria-hidden>
        {checked ? '✓' : ''}
      </span>
      <span className="timbercity-tickbox-label">{label}</span>
    </span>
  );
}

function TimbercitySheet({ page }: { page: TimbercityFormPage }) {
  const h = page.header;
  return (
    <article className="timbercity-sheet">
      <header className="timbercity-sheet-header">
        <div className="timbercity-sheet-brand-row">
          <div>
            <h3 className="timbercity-sheet-title">Client Cutting List</h3>
            <div className="timbercity-field-row">
              <span className="timbercity-label">Date:</span>
              <span className="timbercity-value">{h.date}</span>
              <span className="timbercity-label timbercity-page-label">Page No:</span>
              <span className="timbercity-page-box">{timbercityPageLabel(h.pageNo, h.totalPages)}</span>
            </div>
          </div>
          <div className="timbercity-brand">
            <div className="timbercity-brand-name">Timbercity</div>
            <div className="timbercity-brand-tag">your project partner</div>
          </div>
        </div>

        <div className="timbercity-header-grid">
          <div className="timbercity-header-col">
            <div className="timbercity-field-row">
              <span className="timbercity-label">Customer Name:</span>
              <span className="timbercity-value timbercity-value-fill">{h.customerName}</span>
            </div>
            <div className="timbercity-field-row">
              <span className="timbercity-label">Phone No:</span>
              <span className="timbercity-value timbercity-value-fill">{h.phoneNo}</span>
            </div>
            <div className="timbercity-field-row">
              <span className="timbercity-label">Email:</span>
              <span className="timbercity-value timbercity-value-fill">{h.email}</span>
            </div>
            <div className="timbercity-field-row">
              <span className="timbercity-label">Board Type:</span>
              <span className="timbercity-value timbercity-value-fill">{h.boardType}</span>
            </div>
            <div className="timbercity-field-row timbercity-grain-row">
              <span className="timbercity-label">Grain:</span>
              <TickBox checked={h.grainYes} label="Y" />
              <TickBox checked={!h.grainYes} label="N" />
            </div>
          </div>
          <div className="timbercity-header-col">
            <div className="timbercity-field-row">
              <span className="timbercity-label">Delivery Address:</span>
              <span className="timbercity-value timbercity-value-fill">{h.deliveryAddress}</span>
            </div>
            <div className="timbercity-field-row">
              <span className="timbercity-label">Job No/Name:</span>
              <span className="timbercity-value timbercity-value-fill">{h.jobNoName}</span>
            </div>
            <div className="timbercity-field-row timbercity-size-row">
              <TickBox checked={h.cuttingSize} label="Cutting Size" />
              <TickBox checked={h.finishedSize} label="Finished Size" />
            </div>
            <div className="timbercity-field-row">
              <span className="timbercity-label">Edging Type:</span>
              <span className="timbercity-value timbercity-value-fill">{h.edgingType}</span>
            </div>
            <div className="timbercity-field-row">
              <span className="timbercity-label">Sales Person:</span>
              <span className="timbercity-value timbercity-value-fill">{h.salesPerson}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="table-wrap timbercity-table-wrap">
        <table className="timbercity-table">
          <thead>
            <tr>
              <th className="timbercity-row-num">#</th>
              <th className="timbercity-num">Length</th>
              <th className="timbercity-num">Width</th>
              <th className="timbercity-num">Quantity</th>
              <th className="timbercity-num">Edge Length</th>
              <th className="timbercity-num">Edge Width</th>
              <th className="timbercity-num">Holes</th>
              <th>Remarks/Notes/Cut Outs</th>
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row, i) => (
              <tr key={i}>
                <td className="timbercity-row-num">{i + 1}</td>
                <td className="timbercity-num">{row ? row.lengthMm : ''}</td>
                <td className="timbercity-num">{row ? row.widthMm : ''}</td>
                <td className="timbercity-num">{row ? row.qty : ''}</td>
                <td className="timbercity-num">{row?.edgeLength ?? ''}</td>
                <td className="timbercity-num">{row?.edgeWidth ?? ''}</td>
                <td className="timbercity-num">{row?.holes ?? ''}</td>
                <td className="timbercity-remarks">{row?.remarks ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="timbercity-sheet-footer">
        <div className="timbercity-field-row">
          <span className="timbercity-label">Special Instructions:</span>
          <span className="timbercity-value timbercity-value-fill">{h.specialInstructions}</span>
        </div>
        <div className="timbercity-footer-row">
          <TickBox checked={false} label="Quote Only" />
          <span className="timbercity-label">Print:</span>
          <span className="timbercity-value timbercity-value-short" />
          <span className="timbercity-label">Customer Signature:</span>
          <span className="timbercity-value timbercity-value-fill" />
          <span className="timbercity-label">Date Signed:</span>
          <span className="timbercity-value timbercity-value-short" />
        </div>
      </footer>
    </article>
  );
}

export function TimbercityFormView({ job, pieces }: Props) {
  const pages = buildTimbercityFormPages(job, pieces);
  if (pages.length === 0) {
    return <p className="hint">No parts to show on the Timbercity form.</p>;
  }
  return (
    <div className="timbercity-form-view">
      {pages.map((page, i) => (
        <TimbercitySheet key={`${page.header.boardType}-${page.header.edgingType}-${page.header.pageNo}-${i}`} page={page} />
      ))}
    </div>
  );
}

import { useState } from 'react';
import { generateCutList } from '../lib/calculator';
import { getDoorDrawerEdgingWarnings } from '../lib/edgingWarnings';
import { getDrawerCutListWarnings, jobNeedsPostformTopQuote, POSTFORM_TOP_NOTICE } from '../lib/cutListWarnings';
import { screwLineDetail } from '../lib/screwRules';
import { connectingFittingLineDetail } from '../lib/connectingFittingRules';
import { getConnectingFittingById } from '../lib/connectingFittingCatalog';
import { UNIT_TYPE_LABELS } from '../lib/constants';
import type { Unit } from '../types';
import { CUT_SIZE_MODE_CUTLIST_HINT, CUT_SIZE_MODE_LABELS } from '../lib/edgingCutSize';
import { formatMoney, resolveQuoteCurrency } from '../lib/currency';
import { exportCutListPdf, type CutListPdfMode } from '../lib/pdf';
import { QuoteTotalsRows } from './QuoteTotals';
import { SheetMapView } from './SheetMapView';
import { grainLabel, MIN_OFFCUT_MM, SAW_KERF_MM } from '../lib/sheetLayout';
import type { CutListGroup, Job } from '../types';

interface Props {
  job: Job;
}

function GroupedCutTable({ groups, showEdging = true }: { groups: CutListGroup[]; showEdging?: boolean }) {
  if (groups.length === 0) {
    return <p className="hint">No pieces in this section.</p>;
  }

  return (
    <>
      {groups.map((group, gi) => {
        const showGrain = group.items.some((p) => p.grain !== 'none');
        return (
          <div key={gi} className="cutlist-group">
            <h4 className="subsection-title">{group.heading}</h4>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>Length × Height (mm)</th>
                    <th>Qty</th>
                    {showGrain && <th>Grain</th>}
                    {showEdging && <th>Edging</th>}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((p, i) => (
                    <tr key={i}>
                      <td>{p.partName}</td>
                      <td>{p.length} × {p.width}</td>
                      <td><strong>{p.totalQty}</strong></td>
                      {showGrain && <td>{grainLabel(p.grain)}</td>}
                      {showEdging && <td>{p.edgingLabel}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}

function QuoteScopeTable({ units }: { units: Unit[] }) {
  const active = units.filter((u) => (u.unitQty ?? 0) > 0);
  if (active.length === 0) return null;
  return (
    <>
      <h3 className="section-title">Scope of work</h3>
      <p className="hint">Summary for your client — no panel sizes on this view.</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Size (W × H × D mm)</th>
            </tr>
          </thead>
          <tbody>
            {active.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{UNIT_TYPE_LABELS[u.type]}</td>
                <td>{u.unitQty}</td>
                <td>{u.width} × {u.height} × {u.depth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function CutListView({ job }: Props) {
  const [mode, setMode] = useState<CutListPdfMode>('full');
  const factory = mode === 'factory';
  const quote = mode === 'quote';
  const showCutLists = !quote;
  const showPricingDetail = !factory;
  const showTechnical = mode === 'full';
  const result = generateCutList(job);
  const showSheetMaps = showCutLists && result.sheetMaps.length > 0;
  const fmt = (n: number) => formatMoney(n, job.settings);
  const currencySymbol = resolveQuoteCurrency(job.settings).symbol;
  const edgingWarnings = getDoorDrawerEdgingWarnings(job);
  const drawerWarnings = getDrawerCutListWarnings(job);
  const showPostformTopNotice = jobNeedsPostformTopQuote(job);
  const hasDrawerParts = result.pieces.some((p) => p.category === 'drawer');
  const hasDrawerRunners = result.hardware.some((h) => h.description === 'Drawer runner pair');
  // Kickplate strips have their own table above; keep them out of Hardware so nothing shows twice.
  const hardwareRows = result.hardware.filter((h) => h.description !== 'Plastic kickplate strip');
  const hardwareTotal = hardwareRows.reduce((sum, h) => sum + h.subtotal, 0);
  const screwsTotal = result.screws.reduce((sum, s) => sum + s.subtotal, 0);
  const sizeMode = job.settings.cutSizeMode ?? 'final';
  const hasGrainParts = result.pieces.some((p) => p.grain !== 'none');

  return (
    <section className="card cutlist-card">
      <div className="cutlist-header">
        <div>
          <h2>{factory ? 'Factory cut list' : quote ? 'Client quotation' : 'Full cut list'}</h2>
          <p className="hint">
            {factory
              ? 'For the cutting factory: panel sizes and edging types only. No metres, prices, kickplate, hinges, screws, or installation.'
              : quote
                ? 'Client-facing: scope of work and quotation total only — no supply breakdown or cut sizes.'
                : 'Full job sheet: cuts plus hardware, screws, installation, and the quote.'}
          </p>
        </div>
        <div className="cutlist-header-actions">
          <div className="tab-bar">
            <button type="button" className={`tab ${factory ? 'active' : ''}`} onClick={() => setMode('factory')}>
              Factory
            </button>
            <button type="button" className={`tab ${quote ? 'active' : ''}`} onClick={() => setMode('quote')}>
              Client quote
            </button>
            <button type="button" className={`tab ${!factory && !quote ? 'active' : ''}`} onClick={() => setMode('full')}>
              Full
            </button>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => exportCutListPdf(job, result, mode)}>
            Download {factory ? 'factory' : quote ? 'client quote' : 'full'} PDF
          </button>
        </div>
      </div>
      {drawerWarnings.length > 0 && (
        <div className="cutlist-warnings" role="alert">
          <strong>Drawers not on cut list</strong>
          <ul>
            {drawerWarnings.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      {edgingWarnings.length > 0 && (
        <div className="cutlist-warnings" role="alert">
          <strong>Edging thickness mismatch</strong>
          <ul>
            {edgingWarnings.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      {(quote || showPostformTopNotice) && showPostformTopNotice && (
        <div className="cutlist-warnings" role="note">
          <strong>Postform tops not included</strong>
          <p>{POSTFORM_TOP_NOTICE}</p>
        </div>
      )}
      {showTechnical && result.sheetWarnings.length > 0 && (
        <div className="cutlist-warnings" role="alert">
          <strong>Part too long for grain direction</strong>
          <ul>
            {result.sheetWarnings.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      {showTechnical && (
      <p className="cutlist-size-mode-alert">
        Size mode: {CUT_SIZE_MODE_LABELS[sizeMode]} — {CUT_SIZE_MODE_CUTLIST_HINT[sizeMode]}
      </p>
      )}
      {showTechnical && hasGrainParts && (
        <p className="hint">
          Grain: sides, doors, drawer fronts and wood kickplates on grain boards are marked <strong>Top to bottom</strong> — grain runs
          along the first size (Length). Sheet counts keep these parts with the grain on the sheet's long side.
        </p>
      )}

      {job.units.length === 0 ? (
        <p className="hint">Add at least one unit to generate a cut list.</p>
      ) : job.units.every((u) => (u.unitQty ?? 0) <= 0) ? (
        <p className="hint">No units on the cut list — set cupboard quantity to 1 or more on at least one unit.</p>
      ) : (
        <>
          {quote && (
            <>
              <QuoteScopeTable units={job.units} />
              <div className="cost-summary cost-summary-wide quote-total-only">
                <QuoteTotalsRows settings={job.settings} grandTotal={result.grandTotal} compact />
              </div>
            </>
          )}

          {showCutLists && (
          <>
          <h3 className="section-title">Board cut list</h3>
          <p className="hint">
            One table per board material and edging tape — carcass, doors and drawer parts together.
            Masonite backs and drawer bottoms are listed under Masonite.
            {!hasDrawerParts && !drawerWarnings.length && (
              <> No drawer parts on this job — add drawers on a unit and set <strong>Qty per cupboard</strong> to 1 or more.</>
            )}
          </p>
          <GroupedCutTable groups={result.boardGroups} />

          <h3 className="section-title">Masonite cut list</h3>
          <p className="hint">Carcass backs and drawer bottoms — 2 mm smaller on length and width.</p>
          <GroupedCutTable groups={result.masoniteGroups} showEdging={false} />

          {showTechnical && (
            <>
              <h3 className="section-title">Board offcuts (suggested keepers)</h3>
              <p className="hint">
                Leftover rectangles after nesting your panel sizes on {job.settings.sheetWidth} × {job.settings.sheetHeight}{' '}
                mm melamine (masonite uses its own sheet size). Includes {SAW_KERF_MM} mm saw kerf between parts. Listed only
                if both sides are at least {MIN_OFFCUT_MM} mm.
                {' '}
                <strong>Board wastage %</strong> (Prices &amp; settings) adds extra area when <em>counting sheets for the quote</em> — it
                does not change panel sizes or this nest. Extra sheets from wastage are not shown here.
              </p>
              {result.boardOffcuts.length === 0 ? (
                <p className="hint">No offcuts large enough to list — or no board parts on this job.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th>Sheet #</th>
                        <th>Size (W × L mm)</th>
                        <th>Area (m²)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.boardOffcuts.map((o, i) => (
                        <tr key={`${o.materialId}-${o.sheetIndex}-${i}`}>
                          <td>{o.materialName}</td>
                          <td>{o.sheetIndex}</td>
                          <td>
                            {o.widthMm} × {o.lengthMm}
                          </td>
                          <td>{(o.areaMm2 / 1_000_000).toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {showSheetMaps && (
            <>
              <h3 className="section-title">Visual sheet maps</h3>
              <p className="hint">
                Nesting diagram for each full sheet — tap a sheet to open full screen, then use Previous/Next or arrow
                keys; scroll the wheel to zoom and drag to pan. Grain runs along the long side (→). Hatched parts are
                grain-locked; dashed areas are keeper
                offcuts ({MIN_OFFCUT_MM} mm+).
              </p>
              <SheetMapView groups={result.sheetMaps} />
            </>
          )}
          </>
          )}

          {showCutLists && result.consolidatedEdging.length > 0 && (
            <>
              <h3 className="section-title">Edging tape</h3>
              {factory ? (
                <p className="hint">
                  Edging types used on this job (per-piece edging is on each cut table above). Metres are calculated in
                  the factory software.
                </p>
              ) : (
                <p className="hint">Total metres per edging type — order tape by length, not per board or pattern.</p>
              )}
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Edging material</th>
                      <th>Thickness</th>
                      {!factory && <th>Total (m)</th>}
                      {!factory && <th>{currencySymbol}/m</th>}
                      {!factory && <th>Cost</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {result.consolidatedEdging.map((e, i) => (
                      <tr key={i}>
                        <td>{e.edgingMaterialName}</td>
                        <td>{e.thickness} mm</td>
                        {!factory && <td>{e.totalLm.toFixed(2)}</td>}
                        {!factory && <td>{fmt(e.pricePerMetre)}</td>}
                        {!factory && <td>{fmt(e.subtotal)}</td>}
                      </tr>
                    ))}
                    {!factory && (
                      <tr className="total-row">
                        <td colSpan={2}><strong>Edging total</strong></td>
                        <td>
                          <strong>
                            {result.consolidatedEdging.reduce((sum, e) => sum + e.totalLm, 0).toFixed(2)}
                          </strong>
                        </td>
                        <td></td>
                        <td>
                          <strong>
                            {fmt(result.consolidatedEdging.reduce((sum, e) => sum + e.subtotal, 0))}
                          </strong>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {showPricingDetail && showTechnical && result.plasticKickplates.length > 0 && (
            <>
              <h3 className="section-title">Plastic kickplate</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Unit</th>
                      <th>Coverage</th>
                      <th>Run (mm)</th>
                      <th>Strip H×W (mm)</th>
                      <th>Cupboards</th>
                      <th>Total (m)</th>
                      {!factory && <th>{currencySymbol}/m</th>}
                      {!factory && <th>Subtotal</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {result.plasticKickplates.map((p, i) => (
                      <tr key={i}>
                        <td>{p.unitName}</td>
                        <td>{p.coverageLabel}</td>
                        <td>{p.lengthMm}</td>
                        <td>{p.stripHeight} × {p.stripWidth}</td>
                        <td>{p.cupboardQty}</td>
                        <td>{p.totalMetres.toFixed(2)}</td>
                        {!factory && <td>{fmt(p.pricePerMetre)}</td>}
                        {!factory && <td>{fmt(p.subtotal)}</td>}
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan={5}><strong>Job total</strong></td>
                      <td><strong>{result.plasticKickplateTotalMetres.toFixed(2)}</strong></td>
                      {!factory && <td></td>}
                      {!factory && <td><strong>{fmt(result.plasticKickplateTotalMetres * job.plasticKickplate.pricePerMetre)}</strong></td>}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {showPricingDetail && showTechnical && hardwareRows.length > 0 && (
            <>
              <h3 className="section-title">Hardware</h3>
              {!hasDrawerRunners && job.units.some((u) => (u.unitQty ?? 0) > 0 && u.drawers.length > 0) && (
                <p className="hint">No drawer runner pairs on this job — check each unit&apos;s Drawers section and set <strong>Qty per cupboard</strong> to 1 or more.</p>
              )}
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Unit</th>
                      <th>Qty</th>
                      <th>Detail</th>
                      <th>Unit price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hardwareRows.map((h, i) => (
                      <tr key={i}>
                        <td>{h.description}</td>
                        <td>{h.unitName}</td>
                        <td>{h.qty}</td>
                        <td>{h.detail}</td>
                        <td>{fmt(h.pricePerPair)}</td>
                        <td>{fmt(h.subtotal)}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan={5}><strong>Hardware total</strong></td>
                      <td><strong>{fmt(hardwareTotal)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {showPricingDetail && showTechnical && result.screws.length > 0 && (
            <>
              <h3 className="section-title">Screws &amp; fittings (job total)</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>SKU</th>
                      <th>Qty needed</th>
                      <th>Packs</th>
                      <th>Pack price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.screws.map((s) => (
                      <tr key={s.screwId}>
                        <td>{s.name}</td>
                        <td>{s.sku}</td>
                        <td title={s.usageDetail}>{s.totalScrews}</td>
                        <td>{s.packsNeeded} × {s.packSize}</td>
                        <td>{fmt(s.packPrice)}</td>
                        <td>{fmt(s.subtotal)}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan={5}><strong>Screws &amp; fittings total</strong></td>
                      <td><strong>{fmt(screwsTotal)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="hint">
                {result.screws.map((s) =>
                  getConnectingFittingById(s.screwId) ? connectingFittingLineDetail(s) : screwLineDetail(s),
                ).join(' · ')}
              </p>
            </>
          )}

          {showPricingDetail && result.install && !quote && (
            <>
              <h3 className="section-title">Installation estimate</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Unit</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>Base</th>
                      <th>Doors</th>
                      <th>Drawers</th>
                      <th>Wall</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.install.lines.map((line) => (
                      <tr key={line.unitName}>
                        <td>{line.unitName}</td>
                        <td>{UNIT_TYPE_LABELS[line.unitType]}</td>
                        <td>{line.cupboardQty}</td>
                        <td>{fmt(line.baseSubtotal)}</td>
                        <td>{line.doorLeaves > 0 ? fmt(line.doorSubtotal) : '—'}</td>
                        <td>{line.drawerCount > 0 ? fmt(line.drawerSubtotal) : '—'}</td>
                        <td>{line.wallPremium > 0 ? fmt(line.wallPremium) : '—'}</td>
                        <td>{fmt(line.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {!quote && (
                      <tr>
                        <td colSpan={7}>Labour subtotal</td>
                        <td>{fmt(result.install.laborSubtotal)}</td>
                      </tr>
                    )}
                    {!quote && result.install.minimumApplied > 0 && (
                      <tr>
                        <td colSpan={7}>Minimum job ({fmt(result.install.minimumJob)})</td>
                        <td>+{fmt(result.install.minimumApplied)}</td>
                      </tr>
                    )}
                    {!quote && result.install.travelFee > 0 && (
                      <tr>
                        <td colSpan={7}>Travel (quoted separately)</td>
                        <td>{fmt(result.install.travelFee)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={7}><strong>Installation total</strong></td>
                      <td><strong>{fmt(result.install.installationTotal)}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {showPricingDetail && !quote && (
          <>
          <h3 className="section-title">Cost estimate</h3>
          <div className="cost-summary cost-summary-wide">
              <>
                {result.costs.map((c, i) => (
                  <div key={i} className="cost-row">
                    <span className="cost-cat">{c.category}</span>
                    <span>{c.name}</span>
                    <span className="cost-detail">{c.detail}</span>
                    <span>{fmt(c.subtotal)}</span>
                  </div>
                ))}
                <div className="cost-row subtotal">
                  <span></span>
                  <span>Material cost total</span>
                  <span></span>
                  <span>{fmt(result.materialsTotal)}</span>
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
              </>
            <QuoteTotalsRows settings={job.settings} grandTotal={result.grandTotal} />
          </div>
          {showTechnical && showPostformTopNotice && (
            <p className="hint hint-inline warn">{POSTFORM_TOP_NOTICE}</p>
          )}
          </>
          )}
          {quote && (
            <p className="hint quote-terms-hint">
              PDF includes exclusions (VAT, postform, appliances, etc.) and validity date. Panel cut lists stay on Factory / Full only.
            </p>
          )}
          {showTechnical && (
            <p className="hint">
              Board sheet counts round up to each material&apos;s <strong>Buy as</strong> step (smallest size that supplier
              sells — so a small overrun can be a ¼ or ½ sheet, not a full sheet). Masonite uses ¼-sheet steps. Confirm
              with nesting before ordering.
            </p>
          )}

          {showTechnical && (
          <details className="detail-breakdown">
            <summary>Per-unit breakdown</summary>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Material</th>
                    <th>Unit</th>
                    <th>Part</th>
                    <th>L × H (mm)</th>
                    <th>Qty</th>
                    <th>Grain</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {result.pieces.map((p, i) => (
                    <tr key={i}>
                      <td>{p.category}</td>
                      <td>{p.materialName}</td>
                      <td>{p.unitName}</td>
                      <td>{p.partName}</td>
                      <td>{p.length} × {p.width}</td>
                      <td>{p.qty}</td>
                      <td>{grainLabel(p.grain)}</td>
                      <td>{p.notes}{p.bottomType ? ` · ${p.bottomType}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          )}
        </>
      )}
    </section>
  );
}

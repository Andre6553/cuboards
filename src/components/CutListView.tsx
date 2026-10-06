import { generateCutList } from '../lib/calculator';
import { getDoorDrawerEdgingWarnings } from '../lib/edgingWarnings';
import { getDrawerCutListWarnings, jobNeedsPostformTopQuote, POSTFORM_TOP_NOTICE } from '../lib/cutListWarnings';
import { screwLineDetail } from '../lib/screwRules';
import { connectingFittingLineDetail } from '../lib/connectingFittingRules';
import { getConnectingFittingById } from '../lib/connectingFittingCatalog';
import { CUT_SIZE_MODE_LABELS, UNIT_TYPE_LABELS } from '../lib/constants';
import { exportCutListPdf } from '../lib/pdf';
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
      {groups.map((group, gi) => (
        <div key={gi} className="cutlist-group">
          <h4 className="subsection-title">{group.heading}</h4>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Length × Height (mm)</th>
                  <th>Qty</th>
                  {showEdging && <th>Edging</th>}
                </tr>
              </thead>
              <tbody>
                {group.items.map((p, i) => (
                  <tr key={i}>
                    <td>{p.length} × {p.width}</td>
                    <td><strong>{p.totalQty}</strong></td>
                    {showEdging && <td>{p.edgingLabel}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

export function CutListView({ job }: Props) {
  const result = generateCutList(job);
  const edgingWarnings = getDoorDrawerEdgingWarnings(job);
  const drawerWarnings = getDrawerCutListWarnings(job);
  const showPostformTopNotice = jobNeedsPostformTopQuote(job);
  const hasDrawerParts = result.pieces.some((p) => p.category === 'drawer');
  const hasDrawerRunners = result.hardware.some((h) => h.description === 'Drawer runner pair');

  return (
    <section className="card cutlist-card">
      <div className="cutlist-header">
        <h2>Cut list & costing</h2>
        <button type="button" className="btn btn-primary" onClick={() => exportCutListPdf(job, result)}>
          Download PDF
        </button>
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
      {showPostformTopNotice && (
        <div className="cutlist-warnings" role="note">
          <strong>Postform tops not included</strong>
          <p>{POSTFORM_TOP_NOTICE}</p>
        </div>
      )}
      <p className="hint">
        Size mode: <strong>{CUT_SIZE_MODE_LABELS[job.settings.cutSizeMode ?? 'final']}</strong>
      </p>

      {job.units.length === 0 ? (
        <p className="hint">Add at least one unit to generate a cut list.</p>
      ) : job.units.every((u) => (u.unitQty ?? 0) <= 0) ? (
        <p className="hint">No units on the cut list — set cupboard quantity to 1 or more on at least one unit.</p>
      ) : (
        <>
          <h3 className="section-title">Carcass cut list</h3>
          <p className="hint">
            Sides, shelves, fillers, kickplates — one table per board material. Drawer box parts (1 long edge, 1 long + 2 short)
            and solid bottoms on the same board with the same edging tape are included at the bottom of that table.
          </p>
          <GroupedCutTable groups={result.carcassGroups} />

          <h3 className="section-title">Doors &amp; drawers cut list</h3>
          <p className="hint">
            Doors, drawer fronts, and parts on a different board or edging tape.
            Matching drawer box cuts on the same board + tape as the carcass are listed under Carcass cut list.
            Masonite drawer bottoms are listed under Masonite.
            {!hasDrawerParts && !drawerWarnings.length && (
              <> No drawer parts on this job — add drawers on a unit and set <strong>Qty per cupboard</strong> to 1 or more.</>
            )}
          </p>
          <GroupedCutTable groups={result.facadeGroups} />

          <h3 className="section-title">Masonite cut list</h3>
          <p className="hint">Carcass backs and drawer bottoms — 2 mm smaller on length and width.</p>
          <GroupedCutTable groups={result.masoniteGroups} showEdging={false} />

          {result.consolidatedEdging.length > 0 && (
            <>
              <h3 className="section-title">Edging tape</h3>
              <p className="hint">Total metres per edging type — order tape by length, not per board or pattern.</p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Edging material</th>
                      <th>Thickness</th>
                      <th>Total (m)</th>
                      <th>R/m</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.consolidatedEdging.map((e, i) => (
                      <tr key={i}>
                        <td>{e.edgingMaterialName}</td>
                        <td>{e.thickness} mm</td>
                        <td>{e.totalLm.toFixed(2)}</td>
                        <td>R {e.pricePerMetre.toFixed(2)}</td>
                        <td>R {e.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
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
                          R {result.consolidatedEdging.reduce((sum, e) => sum + e.subtotal, 0).toFixed(2)}
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {result.plasticKickplates.length > 0 && (
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
                      <th>R/m</th>
                      <th>Subtotal</th>
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
                        <td>R {p.pricePerMetre.toFixed(2)}</td>
                        <td>R {p.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan={5}><strong>Job total</strong></td>
                      <td><strong>{result.plasticKickplateTotalMetres.toFixed(2)}</strong></td>
                      <td></td>
                      <td><strong>R {(result.plasticKickplateTotalMetres * job.plasticKickplate.pricePerMetre).toFixed(2)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {result.hardware.length > 0 && (
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
                    {result.hardware.map((h, i) => (
                      <tr key={i}>
                        <td>{h.description}</td>
                        <td>{h.unitName}</td>
                        <td>{h.qty}</td>
                        <td>{h.detail}</td>
                        <td>R {h.pricePerPair.toFixed(2)}</td>
                        <td>R {h.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {result.screws.length > 0 && (
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
                        <td>R {s.packPrice.toFixed(2)}</td>
                        <td>R {s.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
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

          {result.install && (
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
                        <td>R {line.baseSubtotal.toFixed(2)}</td>
                        <td>{line.doorLeaves > 0 ? `R ${line.doorSubtotal.toFixed(2)}` : '—'}</td>
                        <td>{line.drawerCount > 0 ? `R ${line.drawerSubtotal.toFixed(2)}` : '—'}</td>
                        <td>{line.wallPremium > 0 ? `R ${line.wallPremium.toFixed(2)}` : '—'}</td>
                        <td>R {line.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={7}>Labour subtotal</td>
                      <td>R {result.install.laborSubtotal.toFixed(2)}</td>
                    </tr>
                    {result.install.minimumApplied > 0 && (
                      <tr>
                        <td colSpan={7}>Minimum job (R {result.install.minimumJob.toFixed(2)})</td>
                        <td>+R {result.install.minimumApplied.toFixed(2)}</td>
                      </tr>
                    )}
                    {result.install.travelFee > 0 && (
                      <tr>
                        <td colSpan={7}>Travel (quoted separately)</td>
                        <td>R {result.install.travelFee.toFixed(2)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={7}><strong>Installation total</strong></td>
                      <td><strong>R {result.install.installationTotal.toFixed(2)}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          <h3 className="section-title">Cost estimate</h3>
          <div className="cost-summary cost-summary-wide">
            {result.costs.map((c, i) => (
              <div key={i} className="cost-row">
                <span className="cost-cat">{c.category}</span>
                <span>{c.name}</span>
                <span className="cost-detail">{c.detail}</span>
                <span>R {c.subtotal.toFixed(2)}</span>
              </div>
            ))}
            <div className="cost-row subtotal">
              <span></span>
              <span>Material cost total</span>
              <span></span>
              <span>R {result.materialsTotal.toFixed(2)}</span>
            </div>
            <div className="cost-row subtotal">
              <span className="cost-cat">install</span>
              <span>Installation cost total</span>
              <span className="cost-detail">
                {result.install
                  ? `${result.install.lines.length} unit(s)${result.install.minimumApplied > 0 ? ' · min job applied' : ''}`
                  : 'Not included'}
              </span>
              <span>R {result.installationTotal.toFixed(2)}</span>
            </div>
            <div className="cost-row subtotal">
              <span></span>
              <span>Travel total</span>
              <span></span>
              <span>R {result.travelTotal.toFixed(2)}</span>
            </div>
            <div className="cost-row total">
              <span></span>
              <span>Grand total</span>
              <span></span>
              <span>R {result.grandTotal.toFixed(2)}</span>
            </div>
          </div>
          {showPostformTopNotice && (
            <p className="hint hint-inline warn">{POSTFORM_TOP_NOTICE}</p>
          )}
          <p className="hint">Board & masonite costs use area ÷ sheet size, rounded up in ¼-sheet steps (you can buy a quarter board). Confirm with nesting before ordering.</p>

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
                      <td>{p.notes}{p.bottomType ? ` · ${p.bottomType}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CUT_SIZE_MODE_LABELS } from './constants';
import { jobNeedsPostformTopQuote, POSTFORM_TOP_NOTICE } from './cutListWarnings';
import type { CutListGroup, CutListResult, Job } from '../types';

function renderGroupedSection(
  doc: jsPDF,
  y: number,
  margin: number,
  title: string,
  groups: CutListGroup[],
  showEdging = true,
): number {
  if (groups.length === 0) return y;

  if (y > 150) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(12);
  doc.text(title, margin, y);
  y += 4;

  for (const group of groups) {
    if (y > 165) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(group.heading, margin, y);
    y += 3;
    doc.setTextColor(0);

    autoTable(doc, {
      startY: y,
      head: showEdging
        ? [['Length×Height (mm)', 'Qty', 'Edging']]
        : [['Length×Height (mm)', 'Qty']],
      body: showEdging
        ? group.items.map((p) => [`${p.length} × ${p.width}`, p.totalQty.toString(), p.edgingLabel])
        : group.items.map((p) => [`${p.length} × ${p.width}`, p.totalQty.toString()]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [45, 55, 72] },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  return y + 2;
}

export function exportCutListPdf(job: Job, result: CutListResult): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 14;
  let y = margin;

  doc.setFontSize(18);
  doc.text('Cuboards — Cut List', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(
    `Client: ${job.client.name || '—'}  |  Ref: ${job.client.ref || '—'}  |  Phone: ${job.client.phone || '—'}`,
    margin,
    y,
  );
  y += 5;
  doc.text(`Address: ${job.client.address || '—'}`, margin, y);
  y += 5;
  doc.text(
    `Board: ${job.settings.thickness}mm  |  Sheet: ${job.settings.sheetWidth}×${job.settings.sheetHeight}mm  |  Cut sizes: ${CUT_SIZE_MODE_LABELS[job.settings.cutSizeMode ?? 'final']}  |  Generated: ${new Date().toLocaleString()}`,
    margin,
    y,
  );
  y += 8;
  doc.setTextColor(0);

  if (jobNeedsPostformTopQuote(job)) {
    doc.setFontSize(9);
    doc.setTextColor(146, 64, 14);
    const noticeLines = doc.splitTextToSize(`Postform tops not included — ${POSTFORM_TOP_NOTICE}`, 270);
    doc.text(noticeLines, margin, y);
    y += noticeLines.length * 4 + 4;
    doc.setTextColor(0);
  }

  y = renderGroupedSection(doc, y, margin, 'Carcass cut list', result.carcassGroups);
  y = renderGroupedSection(doc, y, margin, 'Doors & drawers cut list', result.facadeGroups);
  y = renderGroupedSection(doc, y, margin, 'Masonite cut list', result.masoniteGroups, false);

  if (result.consolidatedEdging.length > 0) {
    const edgingTotalLm = result.consolidatedEdging.reduce((sum, e) => sum + e.totalLm, 0);
    const edgingTotalCost = result.consolidatedEdging.reduce((sum, e) => sum + e.subtotal, 0);

    doc.setFontSize(12);
    doc.text('Edging tape', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Edging', 'Thick', 'Total (m)', 'R/m', 'Cost']],
      body: [
        ...result.consolidatedEdging.map((e) => [
          e.edgingMaterialName,
          `${e.thickness} mm`,
          e.totalLm.toFixed(2),
          `R ${e.pricePerMetre.toFixed(2)}`,
          `R ${e.subtotal.toFixed(2)}`,
        ]),
        ['Edging total', '', edgingTotalLm.toFixed(2), '', `R ${edgingTotalCost.toFixed(2)}`],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [45, 55, 72] },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (result.plasticKickplates.length > 0) {
    if (y > 150) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.text('Plastic kickplate', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Unit', 'Coverage', 'Run (mm)', 'Strip H×W', 'Cupboards', 'Total (m)', 'R/m', 'Subtotal']],
      body: [
        ...result.plasticKickplates.map((p) => [
          p.unitName,
          p.coverageLabel,
          p.lengthMm.toString(),
          `${p.stripHeight}×${p.stripWidth}`,
          p.cupboardQty.toString(),
          p.totalMetres.toFixed(2),
          `R ${p.pricePerMetre.toFixed(2)}`,
          `R ${p.subtotal.toFixed(2)}`,
        ]),
        ['Job total', '', '', '', '', result.plasticKickplateTotalMetres.toFixed(2), '', `R ${(result.plasticKickplateTotalMetres * job.plasticKickplate.pricePerMetre).toFixed(2)}`],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [45, 55, 72] },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (result.hardware.length > 0) {
    if (y > 150) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.text('Hardware', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Item', 'Unit', 'Qty', 'Detail', 'R/pair', 'Subtotal']],
      body: result.hardware.map((h) => [
        h.description,
        h.unitName,
        h.qty.toString(),
        h.detail,
        `R ${h.pricePerPair.toFixed(2)}`,
        `R ${h.subtotal.toFixed(2)}`,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [45, 55, 72] },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (y > 160) { doc.addPage(); y = margin; }

  doc.setFontSize(12);
  doc.text('Cost summary', margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Category', 'Item', 'Detail', 'Subtotal']],
    body: [
      ...result.costs.map((c) => [
        c.category,
        c.name,
        c.detail,
        `R ${c.subtotal.toFixed(2)}`,
      ]),
      ['', 'Material cost total', '', `R ${result.materialsTotal.toFixed(2)}`],
      [
        'install',
        'Installation cost total',
        result.install
          ? `${result.install.lines.length} unit(s)${result.install.minimumApplied > 0 ? ' · min job applied' : ''}`
          : 'Not included',
        `R ${result.installationTotal.toFixed(2)}`,
      ],
      ['', 'Travel total', '', `R ${result.travelTotal.toFixed(2)}`],
      ['', 'GRAND TOTAL', '', `R ${result.grandTotal.toFixed(2)}`],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [45, 55, 72] },
    margin: { left: margin, right: margin },
  });

  const filename = `cutlist-${job.client.ref || job.client.name || 'job'}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CUT_SIZE_MODE_LABELS } from './constants';
import { CUT_SIZE_MODE_CUTLIST_HINT } from './edgingCutSize';
import { jobNeedsPostformTopQuote, POSTFORM_TOP_NOTICE } from './cutListWarnings';
import { exportClientQuotePdf } from './quotePdf';
import { calcVatTotalsForJob, resolvePricesEnterAsInclVat, resolveShowVatOnQuote } from './vat';
import { grainLabel } from './sheetLayout';
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

    const showGrain = group.items.some((p) => p.grain !== 'none');
    const head = ['Length×Height (mm)', 'Qty'];
    if (showGrain) head.push('Grain');
    if (showEdging) head.push('Edging');

    autoTable(doc, {
      startY: y,
      head: [head],
      body: group.items.map((p) => {
        const row = [`${p.length} × ${p.width}`, p.totalQty.toString()];
        if (showGrain) row.push(grainLabel(p.grain));
        if (showEdging) row.push(p.edgingLabel);
        return row;
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [45, 55, 72] },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  return y + 2;
}

const SIZE_MODE_NOTE_RED: [number, number, number] = [185, 28, 28];

function drawSizeModeNote(doc: jsPDF, margin: number, y: number, job: Job, prominent: boolean): number {
  const sizeMode = job.settings.cutSizeMode ?? 'final';
  const note = `Note: Size mode: ${CUT_SIZE_MODE_LABELS[sizeMode]} — ${CUT_SIZE_MODE_CUTLIST_HINT[sizeMode]}`;
  const fontSize = prominent ? 14 : 11;
  const gapAfter = prominent ? 6 : 4;
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = pageWidth - margin * 2;
  const padX = prominent ? 6 : 0;
  const padY = prominent ? 5 : 0;
  const textMaxWidth = boxWidth - padX * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  const textDims = doc.getTextDimensions(note, { maxWidth: textMaxWidth, fontSize });
  const textOpts = { maxWidth: textMaxWidth, baseline: 'top' as const };

  if (prominent) {
    const boxH = padY * 2 + textDims.h + 1;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(248, 113, 113);
    doc.roundedRect(margin, y, boxWidth, boxH, 2, 2, 'FD');
    doc.setTextColor(...SIZE_MODE_NOTE_RED);
    doc.text(note, margin + padX, y + padY, textOpts);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    return y + boxH + gapAfter;
  }

  doc.setTextColor(...SIZE_MODE_NOTE_RED);
  doc.text(note, margin, y, textOpts);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  return y + textDims.h + gapAfter;
}

export type CutListPdfMode = 'factory' | 'full' | 'quote';

export function exportCutListPdf(job: Job, result: CutListResult, mode: CutListPdfMode = 'full'): void {
  if (mode === 'quote') {
    exportClientQuotePdf(job, result);
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 14;
  let y = margin;
  const factory = mode === 'factory';

  doc.setFontSize(18);
  doc.text(factory ? 'Cuboards — Factory cut list' : 'Cuboards — Full cut list', margin, y);
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
    `Board: ${job.settings.thickness}mm  |  Sheet: ${job.settings.sheetWidth}×${job.settings.sheetHeight}mm  |  Generated: ${new Date().toLocaleString()}`,
    margin,
    y,
  );
  y += 6;
  doc.setTextColor(0);
  y = drawSizeModeNote(doc, margin, y, job, factory);

  if (jobNeedsPostformTopQuote(job)) {
    doc.setFontSize(9);
    doc.setTextColor(146, 64, 14);
    const noticeLines = doc.splitTextToSize(`Postform tops not included — ${POSTFORM_TOP_NOTICE}`, 270);
    doc.text(noticeLines, margin, y);
    y += noticeLines.length * 4 + 4;
    doc.setTextColor(0);
  }

  if (result.pieces.some((p) => p.grain !== 'none')) {
    doc.setFontSize(9);
    doc.setTextColor(60);
    const grainLines = doc.splitTextToSize(
      'Grain: parts marked "Top to bottom" (sides, doors, drawer fronts) have the grain along the first size (Length). Do not rotate these on the sheet.',
      270,
    );
    doc.text(grainLines, margin, y);
    y += grainLines.length * 4 + 3;
    doc.setTextColor(0);
  }

  for (const warning of result.sheetWarnings) {
    doc.setFontSize(9);
    doc.setTextColor(...SIZE_MODE_NOTE_RED);
    const warnLines = doc.splitTextToSize(warning, 270);
    doc.text(warnLines, margin, y);
    y += warnLines.length * 4 + 2;
    doc.setTextColor(0);
  }

  y = renderGroupedSection(doc, y, margin, 'Board cut list', result.boardGroups);
  y = renderGroupedSection(doc, y, margin, 'Masonite cut list', result.masoniteGroups, false);

  if (result.consolidatedEdging.length > 0) {
    const edgingTotalLm = result.consolidatedEdging.reduce((sum, e) => sum + e.totalLm, 0);
    const edgingTotalCost = result.consolidatedEdging.reduce((sum, e) => sum + e.subtotal, 0);

    doc.setFontSize(12);
    doc.text('Edging tape', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: factory ? [['Edging type', 'Thick']] : [['Edging', 'Thick', 'Total (m)', 'R/m', 'Cost']],
      body: factory
        ? result.consolidatedEdging.map((e) => [e.edgingMaterialName, `${e.thickness} mm`])
        : [
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

  if (!factory && result.plasticKickplates.length > 0) {
    if (y > 150) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.text('Plastic kickplate', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: factory
        ? [['Unit', 'Coverage', 'Run (mm)', 'Strip H×W', 'Cupboards', 'Total (m)']]
        : [['Unit', 'Coverage', 'Run (mm)', 'Strip H×W', 'Cupboards', 'Total (m)', 'R/m', 'Subtotal']],
      body: factory
        ? [
            ...result.plasticKickplates.map((p) => [
              p.unitName,
              p.coverageLabel,
              p.lengthMm.toString(),
              `${p.stripHeight}×${p.stripWidth}`,
              p.cupboardQty.toString(),
              p.totalMetres.toFixed(2),
            ]),
            ['Job total', '', '', '', '', result.plasticKickplateTotalMetres.toFixed(2)],
          ]
        : [
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

  // Kickplate strips are costed in the Plastic kickplate line; keep them out of Hardware.
  const hardwareRows = result.hardware.filter((h) => h.description !== 'Plastic kickplate strip');
  if (!factory && hardwareRows.length > 0) {
    if (y > 150) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.text('Hardware', margin, y);
    y += 2;

    const hardwareTotal = hardwareRows.reduce((sum, h) => sum + h.subtotal, 0);
    autoTable(doc, {
      startY: y,
      head: [['Item', 'Unit', 'Qty', 'Detail', 'Unit price', 'Subtotal']],
      body: hardwareRows.map((h) => [
        h.description,
        h.unitName,
        h.qty.toString(),
        h.detail,
        `R ${h.pricePerPair.toFixed(2)}`,
        `R ${h.subtotal.toFixed(2)}`,
      ]),
      foot: [['Hardware total', '', '', '', '', `R ${hardwareTotal.toFixed(2)}`]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [45, 55, 72] },
      footStyles: { fillColor: [237, 242, 247], textColor: 20, fontStyle: 'bold' },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (!factory && result.screws.length > 0) {
    if (y > 150) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.text('Screws & fittings (job total)', margin, y);
    y += 2;

    const screwsTotal = result.screws.reduce((sum, s) => sum + s.subtotal, 0);
    autoTable(doc, {
      startY: y,
      head: [['Item', 'SKU', 'Qty needed', 'Packs', 'Pack price', 'Subtotal']],
      body: result.screws.map((s) => [
        s.name,
        s.sku,
        s.totalScrews.toString(),
        `${s.packsNeeded} × ${s.packSize}`,
        `R ${s.packPrice.toFixed(2)}`,
        `R ${s.subtotal.toFixed(2)}`,
      ]),
      foot: [['Screws & fittings total', '', '', '', '', `R ${screwsTotal.toFixed(2)}`]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [45, 55, 72] },
      footStyles: { fillColor: [237, 242, 247], textColor: 20, fontStyle: 'bold' },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (!factory) {
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
      ...(resolveShowVatOnQuote(job.settings)
        ? (() => {
            const vat = calcVatTotalsForJob(result.grandTotal, job.settings);
            return [
              ['', 'Subtotal ex VAT', '', `R ${vat.subtotalExVat.toFixed(2)}`],
              ['', `VAT (${vat.ratePercent}%)`, '', `R ${vat.vatAmount.toFixed(2)}`],
              ['', 'TOTAL INCL VAT', '', `R ${vat.totalInclVat.toFixed(2)}`],
            ];
          })()
        : [
            [
              '',
              resolvePricesEnterAsInclVat(job.settings) ? 'GRAND TOTAL (incl VAT)' : 'GRAND TOTAL (ex VAT)',
              '',
              `R ${result.grandTotal.toFixed(2)}`,
            ],
          ]),
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [45, 55, 72] },
    margin: { left: margin, right: margin },
  });
  }

  const slug = job.client.ref || job.client.name || 'job';
  const prefix = factory ? 'factory-cutlist' : 'full-cutlist';
  const filename = `${prefix}-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

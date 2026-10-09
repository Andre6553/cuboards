import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CUT_SIZE_MODE_LABELS } from './constants';
import { CUT_SIZE_MODE_CUTLIST_HINT } from './edgingCutSize';
import { jobNeedsPostformTopQuote, POSTFORM_TOP_NOTICE } from './cutListWarnings';
import { exportClientQuotePdf } from './quotePdf';
import { formatMoney, resolveQuoteCurrency } from './currency';
import { calcVatTotalsForJob, resolvePricesEnterAsInclVat, resolveShowVatOnQuote } from './vat';
import { grainLabel, MIN_OFFCUT_MM, resolveSawKerfMm } from './sheetLayout';
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
    const head = ['Part', 'Length×Height (mm)', 'Qty'];
    if (showGrain) head.push('Grain');
    if (showEdging) head.push('Edging');

    autoTable(doc, {
      startY: y,
      head: [head],
      body: group.items.map((p) => {
        const row = [p.partName, `${p.length} × ${p.width}`, p.totalQty.toString()];
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
  const fmt = (n: number) => formatMoney(n, job.settings);
  const curSym = resolveQuoteCurrency(job.settings).symbol;

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
      'Grain: parts marked "Top to bottom" (sides, doors, drawer fronts, wood kickplates) have the grain along the first size (Length). Do not rotate these on the sheet.',
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

  if (!factory && result.boardOffcuts.length > 0) {
    if (y > 150) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(12);
    doc.text('Board offcuts (suggested keepers)', margin, y);
    y += 3;
    doc.setFontSize(8);
    doc.setTextColor(80);
    const offcutNote = doc.splitTextToSize(
      `Nesting on ${job.settings.sheetWidth}×${job.settings.sheetHeight} mm sheets, ${resolveSawKerfMm(job.settings)} mm kerf, min ${MIN_OFFCUT_MM} mm both sides. Board wastage % affects quote sheet count only — not this list.`,
      270,
    );
    doc.text(offcutNote, margin, y);
    y += offcutNote.length * 3.5 + 2;
    doc.setTextColor(0);

    autoTable(doc, {
      startY: y,
      head: [['Material', 'Sheet #', 'W × L (mm)', 'Area (m²)']],
      body: result.boardOffcuts.map((o) => [
        o.materialName,
        String(o.sheetIndex),
        `${o.widthMm} × ${o.lengthMm}`,
        (o.areaMm2 / 1_000_000).toFixed(3),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [45, 55, 72] },
      margin: { left: margin, right: margin },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (result.consolidatedEdging.length > 0) {
    const edgingTotalLm = result.consolidatedEdging.reduce((sum, e) => sum + e.totalLm, 0);
    const edgingTotalCost = result.consolidatedEdging.reduce((sum, e) => sum + e.subtotal, 0);

    doc.setFontSize(12);
    doc.text('Edging tape', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: factory ? [['Edging type', 'Thick']] : [['Edging', 'Thick', 'Total (m)', `${curSym}/m`, 'Cost']],
      body: factory
        ? result.consolidatedEdging.map((e) => [e.edgingMaterialName, `${e.thickness} mm`])
        : [
            ...result.consolidatedEdging.map((e) => [
              e.edgingMaterialName,
              `${e.thickness} mm`,
              e.totalLm.toFixed(2),
              fmt(e.pricePerMetre),
              fmt(e.subtotal),
            ]),
            ['Edging total', '', edgingTotalLm.toFixed(2), '', fmt(edgingTotalCost)],
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
        : [['Unit', 'Coverage', 'Run (mm)', 'Strip H×W', 'Cupboards', 'Total (m)', `${curSym}/m`, 'Subtotal']],
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
              fmt(p.pricePerMetre),
              fmt(p.subtotal),
            ]),
            ['Job total', '', '', '', '', result.plasticKickplateTotalMetres.toFixed(2), '', fmt(result.plasticKickplateTotalMetres * job.plasticKickplate.pricePerMetre)],
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
        fmt(h.pricePerPair),
        fmt(h.subtotal),
      ]),
      foot: [['Hardware total', '', '', '', '', fmt(hardwareTotal)]],
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
        fmt(s.packPrice),
        fmt(s.subtotal),
      ]),
      foot: [['Screws & fittings total', '', '', '', '', fmt(screwsTotal)]],
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
        fmt(c.subtotal),
      ]),
      ['', 'Material cost total', '', fmt(result.materialsTotal)],
      [
        'install',
        'Installation cost total',
        result.install
          ? `${result.install.lines.length} unit(s)${result.install.minimumApplied > 0 ? ' · min job applied' : ''}`
          : 'Not included',
        fmt(result.installationTotal),
      ],
      ['', 'Travel total', '', fmt(result.travelTotal)],
      ...(resolveShowVatOnQuote(job.settings)
        ? (() => {
            const vat = calcVatTotalsForJob(result.grandTotal, job.settings);
            return [
              ['', 'Subtotal ex VAT', '', fmt(vat.subtotalExVat)],
              ['', `VAT (${vat.ratePercent}%)`, '', fmt(vat.vatAmount)],
              ['', 'TOTAL INCL VAT', '', fmt(vat.totalInclVat)],
            ];
          })()
        : [
            [
              '',
              resolvePricesEnterAsInclVat(job.settings) ? 'GRAND TOTAL (incl VAT)' : 'GRAND TOTAL (ex VAT)',
              '',
              fmt(result.grandTotal),
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

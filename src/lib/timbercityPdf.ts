import jsPDF from 'jspdf';
import type { CutListResult, CutPiece, Job } from '../types';
import { filterPiecesForOrderSupplier } from './orderSupplier';
import {
  buildTimbercityFormPages,
  TIMBERCITY_ROWS_PER_PAGE,
  type TimbercityFormPage,
} from './timbercityCutList';

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function drawTick(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  checked: boolean,
): void {
  doc.setDrawColor(30);
  doc.setLineWidth(0.25);
  doc.rect(x, y - size + 0.5, size, size);
  if (checked) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('X', x + 0.9, y - 0.4);
  }
}

function drawFieldLine(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  labelW: number,
  valueW: number,
): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  const text = value || '';
  const maxW = valueW - 2;
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines[0] || '', x + labelW, y);
  doc.setDrawColor(160);
  doc.setLineWidth(0.15);
  doc.line(x + labelW, y + 1, x + labelW + valueW, y + 1);
}

function drawTimbercityPage(doc: jsPDF, page: TimbercityFormPage, isFirst: boolean): void {
  if (!isFirst) doc.addPage();
  const h = page.header;
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const right = pageW - margin;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text('Client Cutting List', margin, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(180, 30, 30);
  doc.text('Timbercity', right, y + 2, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text('your project partner', right, y + 6, { align: 'right' });
  doc.setTextColor(0);
  y += 12;

  doc.setFontSize(8);
  drawFieldLine(doc, 'Date:', h.date, margin, y, 12, 40);
  doc.setFont('helvetica', 'bold');
  doc.text('Page No:', margin + 60, y);
  doc.setDrawColor(30);
  doc.rect(margin + 78, y - 4, 14, 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(String(h.pageNo), margin + 81, y);
  y += 7;

  const col2 = margin + 98;
  const leftValueW = 70;
  const rightValueW = pageW - col2 - margin - 32;

  drawFieldLine(doc, 'Customer Name:', h.customerName, margin, y, 28, leftValueW);
  drawFieldLine(doc, 'Delivery Address:', h.deliveryAddress, col2, y, 30, rightValueW);
  y += 6;
  drawFieldLine(doc, 'Phone No:', h.phoneNo, margin, y, 28, leftValueW);
  drawFieldLine(doc, 'Job No/Name:', h.jobNoName, col2, y, 30, rightValueW);
  y += 6;
  drawFieldLine(doc, 'Board Type:', h.boardType, margin, y, 28, leftValueW);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  drawTick(doc, col2, y, 3.5, false);
  doc.setFont('helvetica', 'normal');
  doc.text('Cutting Size', col2 + 5, y);
  drawTick(doc, col2 + 38, y, 3.5, true);
  doc.text('Finished Size', col2 + 43, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Grain:', margin, y);
  drawTick(doc, margin + 16, y, 3.5, h.grainYes);
  doc.setFont('helvetica', 'normal');
  doc.text('Y', margin + 21, y);
  drawTick(doc, margin + 28, y, 3.5, !h.grainYes);
  doc.text('N', margin + 33, y);

  drawFieldLine(doc, 'Edging Type:', h.edgingType, col2, y, 26, rightValueW + 4);
  y += 6;
  drawFieldLine(doc, 'Sales Person:', h.salesPerson, col2, y, 26, rightValueW + 4);
  y += 8;

  const colWidths = [8, 22, 22, 18, 28, 28, 16, 54];
  const headers = ['#', 'Length', 'Width', 'Qty', 'Edge Length', 'Edge Width', 'Holes', 'Remarks/Notes/Cut Outs'];
  const tableTop = y;
  const rowH = 6.2;
  const headerH = 7;
  let x = margin;

  doc.setFillColor(245, 245, 245);
  doc.rect(margin, tableTop, colWidths.reduce((a, b) => a + b, 0), headerH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setDrawColor(40);
  doc.setLineWidth(0.2);
  // Centre all columns except Remarks (last).
  const centerCol = (i: number) => i < headers.length - 1;
  for (let i = 0; i < headers.length; i++) {
    doc.rect(x, tableTop, colWidths[i]!, headerH);
    if (centerCol(i)) {
      doc.text(headers[i]!, x + colWidths[i]! / 2, tableTop + 4.5, { align: 'center' });
    } else {
      doc.text(headers[i]!, x + 1.2, tableTop + 4.5);
    }
    x += colWidths[i]!;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  for (let r = 0; r < TIMBERCITY_ROWS_PER_PAGE; r++) {
    const rowY = tableTop + headerH + r * rowH;
    const row = page.rows[r];
    const cells = row
      ? [
          String(r + 1),
          String(row.lengthMm),
          String(row.widthMm),
          String(row.qty),
          row.edgeLength,
          row.edgeWidth,
          row.holes,
          row.remarks,
        ]
      : [String(r + 1), '', '', '', '', '', '', ''];
    x = margin;
    for (let i = 0; i < cells.length; i++) {
      doc.rect(x, rowY, colWidths[i]!, rowH);
      const raw = cells[i] || '';
      if (!raw) {
        x += colWidths[i]!;
        continue;
      }
      if (centerCol(i)) {
        doc.text(raw, x + colWidths[i]! / 2, rowY + 4.2, { align: 'center' });
      } else {
        const cellText = doc.splitTextToSize(raw, colWidths[i]! - 2);
        doc.text(cellText[0] || '', x + 1, rowY + 4.2);
      }
      x += colWidths[i]!;
    }
  }

  y = tableTop + headerH + TIMBERCITY_ROWS_PER_PAGE * rowH + 8;
  drawFieldLine(
    doc,
    'Special Instructions:',
    h.specialInstructions,
    margin,
    y,
    36,
    pageW - margin * 2 - 36,
  );
  y += 8;
  drawTick(doc, margin, y, 3.5, false);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Quote Only', margin + 5, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Print:', margin + 32, y);
  doc.setDrawColor(160);
  doc.line(margin + 44, y + 1, margin + 70, y + 1);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Signature:', margin + 78, y);
  doc.line(margin + 112, y + 1, margin + 160, y + 1);
  doc.text('Date Signed:', margin + 164, y);
  doc.line(margin + 186, y + 1, right, y + 1);
}

export type TimbercityPdfOptions = {
  factoryOrderSupplier?: string | null;
};

export async function exportTimbercityCutListPdf(
  job: Job,
  result: CutListResult,
  options?: TimbercityPdfOptions,
): Promise<void> {
  const supplier = options?.factoryOrderSupplier?.trim() || '';
  const pieces: CutPiece[] = supplier
    ? filterPiecesForOrderSupplier(job, result.pieces, supplier)
    : result.pieces;
  const pages = buildTimbercityFormPages(job, pieces);
  if (pages.length === 0) {
    throw new Error('No parts to put on the Timbercity form.');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pages.forEach((page, i) => drawTimbercityPage(doc, page, i === 0));

  const slug = slugify(job.client.ref || job.client.name || 'job') || 'job';
  const supplierSlug = supplier ? `-${slugify(supplier)}` : '';
  const filename = `timbercity-cutlist-${slug}${supplierSlug}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

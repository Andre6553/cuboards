import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UNIT_TYPE_LABELS } from './constants';
import { jobNeedsPostformTopQuote, POSTFORM_TOP_NOTICE } from './cutListWarnings';
import type { CutListResult, Job } from '../types';

function formatRand(n: number): string {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function supplyCategoryLabel(category: string): string {
  switch (category) {
    case 'board':
      return 'Board materials';
    case 'masonite':
      return 'Masonite / backing';
    case 'edging':
      return 'Edge banding';
    case 'hardware':
      return 'Hardware & fittings';
    default:
      return category;
  }
}

/** Client-facing quotation PDF — line items and totals only (no panel cut sizes). */
export function exportClientQuotePdf(job: Job, result: CutListResult): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Quotation', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 9;

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Reference: ${job.client.ref || '—'}`, margin, y);
  y += 5;
  doc.text(`Date: ${new Date().toLocaleDateString('en-ZA')}`, margin, y);
  y += 7;
  doc.setTextColor(0);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Prepared for', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(job.client.name || '—', margin, y);
  y += 4;
  if (job.client.phone) {
    doc.text(`Phone: ${job.client.phone}`, margin, y);
    y += 4;
  }
  if (job.client.address) {
    const addrLines = doc.splitTextToSize(job.client.address, contentWidth);
    doc.text(addrLines, margin, y);
    y += addrLines.length * 4 + 2;
  } else {
    y += 2;
  }

  const activeUnits = job.units.filter((u) => (u.unitQty ?? 0) > 0);
  if (activeUnits.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Scope of work', margin, y);
    y += 3;
    doc.setFont('helvetica', 'normal');

    autoTable(doc, {
      startY: y,
      head: [['Unit', 'Type', 'Qty', 'Size (W × H × D mm)']],
      body: activeUnits.map((u) => [
        u.name,
        UNIT_TYPE_LABELS[u.type],
        String(u.unitQty ?? 0),
        `${u.width} × ${u.height} × ${u.depth}`,
      ]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: margin, right: margin },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Supply', margin, y);
  y += 3;
  doc.setFont('helvetica', 'normal');

  const supplyLines = result.costs.filter((c) => c.category !== 'install');
  autoTable(doc, {
    startY: y,
    head: [['Item', 'Description', 'Amount']],
    body: [
      ...supplyLines.map((c) => [
        supplyCategoryLabel(c.category),
        `${c.name} — ${c.detail}`,
        formatRand(c.subtotal),
      ]),
      ['', 'Materials & supply subtotal', formatRand(result.materialsTotal)],
    ],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: {
      2: { halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  if (result.install && result.installationTotal > 0) {
    if (y > 240) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Installation', margin, y);
    y += 3;
    doc.setFont('helvetica', 'normal');

    autoTable(doc, {
      startY: y,
      head: [['Unit', 'Detail', 'Amount']],
      body: [
        ...result.install.lines.map((line) => [
          line.unitName,
          line.detail,
          formatRand(line.subtotal),
        ]),
        ...(result.install.minimumApplied > 0
          ? [['', `Minimum job (R ${result.install.minimumJob.toFixed(2)})`, formatRand(result.install.minimumApplied)]]
          : []),
        ['', 'Installation subtotal', formatRand(result.installationTotal)],
      ],
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [37, 99, 235] },
      columnStyles: { 2: { halign: 'right' } },
      margin: { left: margin, right: margin },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  } else if (!result.install) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Installation: not included in this quotation (supply only).', margin, y);
    y += 6;
    doc.setTextColor(0);
  }

  if (result.travelTotal > 0) {
    autoTable(doc, {
      startY: y,
      head: [['', 'Travel', 'Amount']],
      body: [['', 'Travel fee', formatRand(result.travelTotal)]],
      styles: { fontSize: 9, cellPadding: 2.5 },
      theme: 'plain',
      columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: margin, right: margin },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (y > 250) {
    doc.addPage();
    y = margin;
  }

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total quotation', margin + 4, y + 9);
  doc.text(formatRand(result.grandTotal), pageWidth - margin - 4, y + 9, { align: 'right' });
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60);

  const exclusions: string[] = [
    'All amounts are in South African Rand (ZAR). VAT is not shown on this quotation.',
    'Panel cutting sizes and factory cut lists are prepared separately and are not attached.',
    'Appliances, plumbing, electrical work, granite templating, and delivery of third-party items are excluded unless agreed in writing.',
  ];
  if (jobNeedsPostformTopQuote(job)) {
    exclusions.push(POSTFORM_TOP_NOTICE);
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Exclusions & notes', margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  for (const line of exclusions) {
    const wrapped = doc.splitTextToSize(`• ${line}`, contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 3.8 + 1;
  }

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);
  y += 2;
  doc.text(`This quotation is valid until ${validUntil.toLocaleDateString('en-ZA')}.`, margin, y);

  if (job.client.notes?.trim()) {
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Site notes', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(job.client.notes.trim(), contentWidth);
    doc.text(noteLines, margin, y);
  }

  const slug = job.client.ref || job.client.name || 'job';
  const filename = `client-quote-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

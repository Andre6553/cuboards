import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawPdfBrandHeader, loadPdfLogoDataUrl } from './pdfBrand';
import {
  formatShoppingQty,
  hardwareShoppingGrandTotal,
  type HardwareShoppingItem,
} from './hardwareShopping';
import { formatMoney } from './currency';
import type { Job } from '../types';

export async function exportHardwareShoppingPdf(job: Job, items: HardwareShoppingItem[]): Promise<void> {
  const logoDataUrl = await loadPdfLogoDataUrl();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 14;
  const fmt = (n: number) => formatMoney(n, job.settings);
  let y = drawPdfBrandHeader(doc, logoDataUrl, {
    margin,
    y: margin,
    documentTitle: 'Hardware shopping list',
  });

  doc.setFontSize(10);
  doc.text(`Client: ${job.client.name || 'Untitled job'}  |  Ref: ${job.client.ref || '—'}`, margin, y);
  y += 5;
  if (job.client.address) {
    doc.text(`Address: ${job.client.address}`, margin, y);
    y += 5;
  }
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text('Tick boxes for store use. Open Hardware shopping in Cuboards on your phone to tick live.', margin, y);
  doc.setTextColor(0);
  y += 6;

  if (items.length === 0) {
    doc.setFontSize(11);
    doc.text('No hardware on this job.', margin, y);
  } else {
    autoTable(doc, {
      startY: y,
      head: [['', 'Qty', 'Item', 'SKU', 'Supplier', 'Total']],
      body: [
        ...items.map((item) => [
          '',
          formatShoppingQty(item),
          item.description,
          item.sku || '—',
          item.supplier,
          fmt(item.subtotal),
        ]),
        ['', '', 'Grand Total', '', '', fmt(hardwareShoppingGrandTotal(items))],
      ],
      styles: { fontSize: 9, cellPadding: 2.2, overflow: 'linebreak' },
      headStyles: { fillColor: [45, 55, 72], fontSize: 9, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center', valign: 'middle' },
        1: { cellWidth: 20 },
        2: { cellWidth: 48 },
        3: { cellWidth: 20 },
        4: { cellWidth: 28 },
        5: { cellWidth: 28, halign: 'right' },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === items.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [237, 242, 247];
        }
      },
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 0) return;
        if (data.row.index >= items.length) return;
        const size = 4;
        const x = data.cell.x + (data.cell.width - size) / 2;
        const cy = data.cell.y + (data.cell.height - size) / 2;
        doc.setDrawColor(40);
        doc.setLineWidth(0.3);
        doc.rect(x, cy, size, size);
      },
    });
  }

  const slug = job.client.ref || job.client.name || 'job';
  const filename = `hardware-shop-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
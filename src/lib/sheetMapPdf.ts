import type { jsPDF } from 'jspdf';
import type { SheetMapGroup } from '../types';
import { buildSheetMapSvg, sheetMapSvgViewBoxSize } from './sheetMapDiagram';

const PX_PER_MM = 3.78;

function svgStringToJpegDataUrl(svg: string, pixelWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const w = Math.max(1, Math.round(pixelWidth));
      const h = Math.max(1, Math.round((img.height / img.width) * w));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not rasterize sheet map'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load sheet map SVG'));
    };
    img.src = url;
  });
}

export async function appendSheetMapsToPdf(
  doc: jsPDF,
  startY: number,
  margin: number,
  groups: SheetMapGroup[],
): Promise<number> {
  if (groups.length === 0) return startY;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  const cols = 2;
  const gap = 6;
  const cellW = (contentW - gap * (cols - 1)) / cols;
  const captionH = 7;
  const maxDiagramH = 72;

  let y = startY;

  const ensureSpace = (need: number) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  ensureSpace(18);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Visual sheet maps', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80);
  const hint = doc.splitTextToSize(
    'Panel-saw layout: rip strips across the sheet, then crosscut parts along the grain. Grain runs along the long side (→). Dashed areas are keeper offcuts.',
    contentW,
  );
  doc.text(hint, margin, y);
  y += hint.length * 3.5 + 5;
  doc.setTextColor(0);

  for (const group of groups) {
    ensureSpace(14);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(group.materialName, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');

    let col = 0;
    let rowStartY = y;
    let rowMaxH = 0;

    for (const sheet of group.sheets) {
      const patternId = `pdf-${group.materialId}-${sheet.sheetIndex}`;
      const { viewW, viewH } = sheetMapSvgViewBoxSize(sheet, {});
      let diagramW = cellW;
      let diagramH = (diagramW * viewH) / viewW;
      if (diagramH > maxDiagramH) {
        diagramH = maxDiagramH;
        diagramW = (diagramH * viewW) / viewH;
      }
      const blockH = captionH + diagramH + 3;

      if (col === 0) {
        ensureSpace(blockH);
        rowStartY = y;
        rowMaxH = 0;
      }

      const x = margin + col * (cellW + gap);
      doc.setFontSize(8);
      doc.text(
        `Sheet ${sheet.sheetIndex} — ${sheet.grainLengthMm} × ${sheet.crossLengthMm} mm`,
        x,
        rowStartY + 4,
      );

      const svg = buildSheetMapSvg(sheet, patternId, {});
      const pixelWidth = Math.round(diagramW * PX_PER_MM * 2);
      const dataUrl = await svgStringToJpegDataUrl(svg, pixelWidth);
      doc.addImage(dataUrl, 'JPEG', x, rowStartY + captionH, diagramW, diagramH);

      rowMaxH = Math.max(rowMaxH, blockH);
      col += 1;
      if (col >= cols) {
        y = rowStartY + rowMaxH + 4;
        col = 0;
      }
    }

    if (col !== 0) {
      y = rowStartY + rowMaxH + 4;
    }
    y += 3;
  }

  return y + 4;
}

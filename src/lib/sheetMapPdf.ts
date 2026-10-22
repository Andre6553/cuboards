import type { jsPDF } from 'jspdf';
import type { SheetMapGroup } from '../types';
import { buildSheetMapSvg, sheetMapSvgViewBoxSize } from './sheetMapDiagram';

/** Screen px per mm at 96 dpi — used to target ~300 dpi in the embedded PDF image. */
const PX_PER_MM = 3.78;
const PDF_RASTER_DPI = 300;
const PDF_RASTER_SCALE = PDF_RASTER_DPI / 96;

function svgStringToPngDataUrl(svg: string, pixelWidth: number): Promise<string> {
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
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
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
  const captionH = 7;
  const maxDiagramH = pageH - margin * 2 - captionH - 8;

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
    'Panel-saw layout: rip strips across the sheet, then crosscut parts along the grain. Grain runs along the long side (→). Dashed areas are keeper offcuts. One sheet per row — zoom in for part sizes.',
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

    for (const sheet of group.sheets) {
      const patternId = `pdf-${group.materialId}-${sheet.sheetIndex}`;
      const { viewW, viewH } = sheetMapSvgViewBoxSize(sheet, { forPdf: true });
      let diagramW = contentW;
      let diagramH = (diagramW * viewH) / viewW;
      if (diagramH > maxDiagramH) {
        diagramH = maxDiagramH;
        diagramW = (diagramH * viewW) / viewH;
      }
      const blockH = captionH + diagramH + 6;

      ensureSpace(blockH);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Sheet ${sheet.sheetIndex} — ${sheet.grainLengthMm} × ${sheet.crossLengthMm} mm`,
        margin,
        y + 4,
      );
      doc.setFont('helvetica', 'normal');

      const svg = buildSheetMapSvg(sheet, patternId, { forPdf: true });
      const pixelWidth = Math.max(
        3200,
        Math.round(diagramW * PX_PER_MM * PDF_RASTER_SCALE),
      );
      const dataUrl = await svgStringToPngDataUrl(svg, pixelWidth);
      const x = margin + (contentW - diagramW) / 2;
      doc.addImage(dataUrl, 'PNG', x, y + captionH, diagramW, diagramH);

      y += blockH;
    }

    y += 3;
  }

  return y + 4;
}

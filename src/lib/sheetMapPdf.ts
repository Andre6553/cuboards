import type { jsPDF } from 'jspdf';
import type { SheetMapGroup } from '../types';
import { buildSheetMapSvg, sheetMapSvgViewBoxSize } from './sheetMapDiagram';

/** Target raster density for the embedded image (px per mm of print size). */
const PX_PER_PRINT_MM = 4;
const MAX_RASTER_WIDTH_PX = 2200;
const MIN_DIAGRAM_H_MM = 24;

function pageBottomY(doc: jsPDF, margin: number): number {
  return doc.internal.pageSize.getHeight() - margin;
}

function remainingHeight(doc: jsPDF, y: number, margin: number): number {
  return pageBottomY(doc, margin) - y;
}

function svgStringToImageDataUrl(svg: string, pixelWidth: number): Promise<string> {
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
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load sheet map SVG'));
    };
    img.src = url;
  });
}

async function rasterizeSheetForPdf(svg: string, diagramW: number): Promise<string> {
  let pixelWidth = Math.min(
    MAX_RASTER_WIDTH_PX,
    Math.max(900, Math.round(diagramW * PX_PER_PRINT_MM)),
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    const dataUrl = await svgStringToImageDataUrl(svg, pixelWidth);
    if (dataUrl.length < 6_000_000) return dataUrl;
    pixelWidth = Math.round(pixelWidth * 0.65);
  }
  return svgStringToImageDataUrl(svg, 900);
}

function addSheetMapImage(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  diagramW: number,
  diagramH: number,
): void {
  try {
    doc.addImage(dataUrl, 'JPEG', x, y, diagramW, diagramH, undefined, 'FAST');
  } catch {
    doc.addImage(dataUrl, 'JPEG', x, y, diagramW, diagramH);
  }
}

export async function appendSheetMapsToPdf(
  doc: jsPDF,
  startY: number,
  margin: number,
  groups: SheetMapGroup[],
): Promise<number> {
  if (groups.length === 0) return startY;

  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;
  const captionH = 7;

  let y = startY;

  const newPage = () => {
    doc.addPage();
    y = margin;
  };

  if (remainingHeight(doc, y, margin) < 35) {
    newPage();
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Visual sheet maps', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80);
  const hint = doc.splitTextToSize(
    'Panel-saw layout: rip strips across the sheet, then crosscut parts along the grain. Grain runs along the long side. Dashed areas are keeper offcuts.',
    contentW,
  );
  doc.text(hint, margin, y);
  y += hint.length * 3.5 + 5;
  doc.setTextColor(0);

  for (const group of groups) {
    if (remainingHeight(doc, y, margin) < 12) {
      newPage();
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(group.materialName, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');

    for (const sheet of group.sheets) {
      const patternId = `pdf-${group.materialId}-${sheet.sheetIndex}`;
      const { viewW, viewH } = sheetMapSvgViewBoxSize(sheet, { forPdf: true });

      if (remainingHeight(doc, y, margin) < captionH + MIN_DIAGRAM_H_MM) {
        newPage();
      }

      const spaceForDiagram = remainingHeight(doc, y + captionH, margin) - 2;
      let diagramH = Math.min(spaceForDiagram, contentW * (viewH / viewW));
      let diagramW = (diagramH * viewW) / viewH;
      if (diagramW > contentW) {
        diagramW = contentW;
        diagramH = (diagramW * viewH) / viewW;
      }
      if (diagramH < MIN_DIAGRAM_H_MM) {
        newPage();
        const space2 = remainingHeight(doc, y + captionH, margin) - 2;
        diagramH = Math.min(space2, contentW * (viewH / viewW));
        diagramW = (diagramH * viewW) / viewH;
        if (diagramW > contentW) {
          diagramW = contentW;
          diagramH = (diagramW * viewH) / viewW;
        }
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Sheet ${sheet.sheetIndex} — ${sheet.grainLengthMm} × ${sheet.crossLengthMm} mm`,
        margin,
        y + 4,
      );
      doc.setFont('helvetica', 'normal');

      const svg = buildSheetMapSvg(sheet, patternId, { forPdf: true });
      const dataUrl = await rasterizeSheetForPdf(svg, diagramW);
      const x = margin + (contentW - diagramW) / 2;
      const imageY = y + captionH;
      addSheetMapImage(doc, dataUrl, x, imageY, diagramW, diagramH);

      y = imageY + diagramH + 6;
    }

    y += 3;
  }

  return y + 4;
}

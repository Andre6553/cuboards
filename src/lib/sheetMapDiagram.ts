import type { SheetMapSheet } from '../types';

export function guillotineCutLines(placements: SheetMapSheet['placements']): {
  ripY: number[];
  cross: { x: number; y: number; h: number }[];
} {
  const stripMap = new Map<number, SheetMapSheet['placements']>();
  for (const p of placements) {
    const list = stripMap.get(p.yMm) ?? [];
    list.push(p);
    stripMap.set(p.yMm, list);
  }
  const ripY: number[] = [];
  const cross: { x: number; y: number; h: number }[] = [];
  for (const [y, parts] of stripMap) {
    const stripH = Math.max(...parts.map((p) => p.heightMm));
    ripY.push(y + stripH);
    const sorted = [...parts].sort((a, b) => a.xMm - b.xMm);
    for (let i = 0; i < sorted.length - 1; i++) {
      const p = sorted[i];
      cross.push({ x: p.xMm + p.widthMm, y, h: stripH });
    }
  }
  ripY.sort((a, b) => a - b);
  return { ripY, cross };
}

function fitFontSize(label: string, boxW: number, boxH: number, scale = 1, forPdf = false): number {
  const base = Math.min(boxW, boxH) * 0.22 * scale;
  const lenFactor = Math.max(1, label.length / 14);
  const raw = base / lenFactor;
  if (forPdf) {
    return Math.max(24, Math.min(52, raw * 0.5));
  }
  return Math.max(5, Math.min(scale > 1 ? 20 : 14, raw));
}

function placementSizeLabel(widthMm: number, heightMm: number): string {
  return `${Math.round(widthMm)} × ${Math.round(heightMm)}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type SheetMapSvgOptions = {
  expanded?: boolean;
  /** Larger part labels for print/PDF raster (same geometry, readable sizes when zoomed). */
  forPdf?: boolean;
  showSheetGrainBand?: boolean;
  showPartGrainArrows?: boolean;
  className?: string;
  pixelWidth?: number;
};

export function sheetMapSvgViewBoxSize(sheet: SheetMapSheet, options: SheetMapSvgOptions = {}): {
  viewW: number;
  viewH: number;
  pad: number;
  grainBand: number;
} {
  const expanded = options.expanded ?? false;
  const showSheetGrainBand = options.showSheetGrainBand ?? false;
  const pad = expanded ? 14 : 8;
  const grainBand = showSheetGrainBand ? 22 : 0;
  const w = sheet.grainLengthMm;
  const h = sheet.crossLengthMm;
  return { viewW: w + pad * 2, viewH: h + pad * 2 + grainBand, pad, grainBand };
}

/** Inline-styled SVG matching on-screen sheet maps (for UI and PDF rasterization). */
export function buildSheetMapSvg(sheet: SheetMapSheet, patternId: string, options: SheetMapSvgOptions = {}): string {
  const expanded = options.expanded ?? false;
  const forPdf = options.forPdf ?? false;
  const showSheetGrainBand = options.showSheetGrainBand ?? false;
  const showPartGrainArrows = options.showPartGrainArrows ?? false;
  const { viewW, viewH, pad, grainBand } = sheetMapSvgViewBoxSize(sheet, options);
  const w = sheet.grainLengthMm;
  const h = sheet.crossLengthMm;
  const hasGrainParts = sheet.placements.some((p) => p.grainLocked);
  const cuts = guillotineCutLines(sheet.placements);
  const cutStroke = expanded ? 1.2 : 0.75;
  const safeId = patternId.replace(/[^a-zA-Z0-9-_]/g, '');

  const widthAttr = options.pixelWidth ? ` width="${options.pixelWidth}"` : '';
  const classAttr = options.className ? ` class="${escapeXml(options.className)}"` : ' class="sheet-map-svg"';

  let body = '';

  if (showSheetGrainBand) {
    body += `<g aria-hidden="true">
      <rect x="${pad}" y="4" width="${w}" height="${grainBand - 8}" rx="3" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.8"/>
      <line x1="${pad + 16}" y1="${grainBand / 2}" x2="${pad + w - 16}" y2="${grainBand / 2}" stroke="#475569" stroke-width="${expanded ? 2 : 1.2}" marker-end="url(#${safeId}-arrow)"/>
      <text x="${pad + w / 2}" y="${grainBand / 2 + 3.5}" text-anchor="middle" fill="#475569" font-family="Segoe UI, system-ui, sans-serif" font-weight="600" font-size="${expanded ? 11 : 8}">Sheet grain →</text>
    </g>`;
  }

  body += `<rect x="${pad}" y="${pad + grainBand}" width="${w}" height="${h}" fill="#fafafa" stroke="#334155" stroke-width="1.2" rx="1"/>`;

  for (let i = 0; i < sheet.offcutRects.length; i++) {
    const r = sheet.offcutRects[i];
    body += `<rect x="${pad + r.xMm}" y="${pad + grainBand + r.yMm}" width="${r.widthMm}" height="${r.heightMm}" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.6" stroke-dasharray="4 3"/>`;
  }

  sheet.placements.forEach((p) => {
    const fontSize = fitFontSize(p.label, p.widthMm, p.heightMm, expanded ? 1.85 : 1, forPdf);
    const cx = pad + p.xMm + p.widthMm / 2;
    const cy = pad + grainBand + p.yMm + p.heightMm / 2;
    const lines = p.label.split(' · ');
    const line1 = lines[0] ?? p.label;
    const line2 = lines[1];
    const sizeText = placementSizeLabel(p.widthMm, p.heightMm);
    const minLabelW = forPdf ? 38 : expanded ? 28 : 55;
    const minLabelH = forPdf ? 28 : expanded ? 16 : 28;
    const minSizeW = forPdf ? 28 : expanded ? 22 : 38;
    const minSizeH = forPdf ? 18 : expanded ? 10 : 16;
    const showName = p.widthMm > minLabelW && p.heightMm > minLabelH;
    const showUnit = !forPdf && showName && line2 && p.heightMm > (expanded ? 40 : 52);
    const showSize = p.widthMm > minSizeW && p.heightMm > minSizeH;
    const sizeFontSize = forPdf ? Math.max(fontSize * 0.95, 26) : showName ? fontSize * 0.82 : fontSize * 0.9;
    const grainLift = showPartGrainArrows && p.grainLocked && showName ? fontSize * 0.35 : 0;
    const rowCount = (showName ? 1 : 0) + (showUnit ? 1 : 0) + (showSize ? 1 : 0);
    const rowStep = fontSize * 1.05;
    const blockTop = cy - grainLift - ((rowCount - 1) * rowStep) / 2;
    let row = 0;

    const fill = p.grainLocked ? `url(#${safeId})` : '#dbeafe';
    body += `<g>`;
    body += `<rect x="${pad + p.xMm}" y="${pad + grainBand + p.yMm}" width="${p.widthMm}" height="${p.heightMm}" fill="${fill}" stroke="#2563eb" stroke-width="0.8"/>`;
    if (showPartGrainArrows && p.grainLocked && p.widthMm > 36 && p.heightMm > 16) {
      body += `<line x1="${pad + p.xMm + 6}" y1="${cy - grainLift}" x2="${pad + p.xMm + p.widthMm - 6}" y2="${cy - grainLift}" stroke="#1d4ed8" stroke-width="${expanded ? 1.4 : 1}" opacity="0.85" marker-end="url(#${safeId}-arrow)"/>`;
    }
    const textWeight = forPdf ? ' font-weight="700"' : '';
    if (showName) {
      const yText = blockTop + row++ * rowStep;
      body += `<text x="${cx}" y="${yText}" text-anchor="middle" dominant-baseline="middle" fill="#0f172a" font-family="Segoe UI, system-ui, sans-serif"${textWeight} font-size="${fontSize}">${escapeXml(line1)}</text>`;
    }
    if (showUnit && line2) {
      const yText = blockTop + row++ * rowStep;
      body += `<text x="${cx}" y="${yText}" text-anchor="middle" dominant-baseline="middle" fill="#475569" font-family="Segoe UI, system-ui, sans-serif" font-size="${fontSize * 0.85}">${escapeXml(line2)}</text>`;
    }
    if (showSize) {
      const yText = blockTop + row++ * rowStep;
      body += `<text x="${cx}" y="${yText}" text-anchor="middle" dominant-baseline="middle" fill="#0f172a" font-family="Segoe UI, system-ui, sans-serif" font-weight="700" font-size="${sizeFontSize}">${escapeXml(sizeText)}</text>`;
    }
    body += `</g>`;
  });

  body += `<g aria-hidden="true">`;
  cuts.ripY.forEach((yRip) => {
    body += `<line x1="${pad}" y1="${pad + grainBand + yRip}" x2="${pad + w}" y2="${pad + grainBand + yRip}" stroke="#dc2626" stroke-width="${cutStroke}" opacity="0.55" stroke-dasharray="6 4"/>`;
  });
  cuts.cross.forEach((c) => {
    body += `<line x1="${pad + c.x}" y1="${pad + grainBand + c.y}" x2="${pad + c.x}" y2="${pad + grainBand + c.y + c.h}" stroke="#dc2626" stroke-width="${cutStroke}" opacity="0.55"/>`;
  });
  body += `</g>`;

  if (!showSheetGrainBand) {
    body += `<text x="${pad + w - 4}" y="${pad + grainBand + 10}" text-anchor="end" fill="#64748b" font-family="Segoe UI, system-ui, sans-serif" font-size="${expanded ? 11 : 9}">grain →</text>`;
  }

  if (expanded && hasGrainParts) {
    body += `<text x="${pad}" y="${viewH - 3}" fill="#64748b" font-family="Segoe UI, system-ui, sans-serif" font-size="9">Hatched + arrow on part = grain fixed (along sheet length)</text>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${viewH}"${widthAttr}${classAttr} role="img" aria-label="Sheet ${sheet.sheetIndex} layout">
  <defs>
    <pattern id="${safeId}" width="8" height="8" patternUnits="userSpaceOnUse">
      <path d="M0 8 L8 0" stroke="#93c5fd" stroke-width="0.6"/>
    </pattern>
    <marker id="${safeId}-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#475569"/>
    </marker>
  </defs>
  ${body}
</svg>`;
}

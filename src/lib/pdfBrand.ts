import type jsPDF from 'jspdf';

/** Matches `CuboardsLogo` / public/logo-mark.png */
const LOGO_MARK_WIDTH = 122;
const LOGO_MARK_HEIGHT = 137;

let cachedLogoDataUrl: string | null = null;

export async function loadPdfLogoDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  const base = import.meta.env.BASE_URL || '/';
  const path = `${base.endsWith('/') ? base : `${base}/`}logo-mark.png`;
  const url = path.startsWith('http') ? path : new URL(path, window.location.origin).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load logo for PDF');
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read logo for PDF'));
    reader.readAsDataURL(blob);
  });
  cachedLogoDataUrl = dataUrl;
  return dataUrl;
}

export type PdfBrandHeaderOptions = {
  margin: number;
  y: number;
  /** e.g. "Full cut list", "Factory cut list", "Quotation" */
  documentTitle: string;
  /** Logo height on the page (mm). */
  logoHeightMm?: number;
};

/** Logo mark + Cuboards wordmark + document title; returns Y below the header block. */
export function drawPdfBrandHeader(doc: jsPDF, logoDataUrl: string, opts: PdfBrandHeaderOptions): number {
  const logoH = opts.logoHeightMm ?? 14;
  const logoW = logoH * (LOGO_MARK_WIDTH / LOGO_MARK_HEIGHT);
  const { margin, y } = opts;

  doc.addImage(logoDataUrl, 'PNG', margin, y, logoW, logoH);

  const textX = margin + logoW + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('Cuboards', textX, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(opts.documentTitle, textX, y + 11);

  doc.setTextColor(0);
  return y + logoH + 5;
}

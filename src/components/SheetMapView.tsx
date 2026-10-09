import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SheetMapGroup, SheetMapSheet } from '../types';

function fitFontSize(label: string, boxW: number, boxH: number, scale = 1): number {
  const base = Math.min(boxW, boxH) * 0.22 * scale;
  const lenFactor = Math.max(1, label.length / 14);
  return Math.max(5, Math.min(14, base / lenFactor));
}

type DiagramProps = {
  sheet: SheetMapSheet;
  patternId: string;
  /** Larger labels and part grain arrows (fullscreen). */
  expanded?: boolean;
  showSheetGrainBand?: boolean;
  showPartGrainArrows?: boolean;
  className?: string;
};

function SheetDiagramSvg({
  sheet,
  patternId,
  expanded = false,
  showSheetGrainBand = false,
  showPartGrainArrows = false,
  className = '',
}: DiagramProps) {
  const w = sheet.grainLengthMm;
  const h = sheet.crossLengthMm;
  const pad = expanded ? 14 : 8;
  const grainBand = showSheetGrainBand ? 22 : 0;
  const viewW = w + pad * 2;
  const viewH = h + pad * 2 + grainBand;

  const hasGrainParts = sheet.placements.some((p) => p.grainLocked);

  return (
    <svg
      className={`sheet-map-svg ${className}`.trim()}
      viewBox={`0 0 ${viewW} ${viewH}`}
      role="img"
      aria-label={`Sheet ${sheet.sheetIndex} layout`}
    >
      <defs>
        <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8 L8 0" stroke="#93c5fd" strokeWidth="0.6" />
        </pattern>
        <marker id={`${patternId}-arrow`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#475569" />
        </marker>
      </defs>

      {showSheetGrainBand && (
        <g className="sheet-map-grain-band" aria-hidden>
          <rect x={pad} y={4} width={w} height={grainBand - 8} rx={3} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.8" />
          <line
            x1={pad + 16}
            y1={grainBand / 2}
            x2={pad + w - 16}
            y2={grainBand / 2}
            stroke="#475569"
            strokeWidth={expanded ? 2 : 1.2}
            markerEnd={`url(#${patternId}-arrow)`}
          />
          <text x={pad + w / 2} y={grainBand / 2 + 3.5} textAnchor="middle" className="sheet-map-grain-band-label" fontSize={expanded ? 11 : 8}>
            Sheet grain →
          </text>
        </g>
      )}

      <rect
        x={pad}
        y={pad + grainBand}
        width={w}
        height={h}
        className="sheet-map-sheet-outline"
        rx={1}
      />

      {sheet.offcutRects.map((r, i) => (
        <rect
          key={`o-${i}`}
          x={pad + r.xMm}
          y={pad + grainBand + r.yMm}
          width={r.widthMm}
          height={r.heightMm}
          className="sheet-map-offcut"
        />
      ))}

      {sheet.placements.map((p, i) => {
        const fontSize = fitFontSize(p.label, p.widthMm, p.heightMm, expanded ? 1.35 : 1);
        const cx = pad + p.xMm + p.widthMm / 2;
        const cy = pad + grainBand + p.yMm + p.heightMm / 2;
        const lines = p.label.split(' · ');
        const line1 = lines[0] ?? p.label;
        const line2 = lines[1];
        const minLabelW = expanded ? 40 : 55;
        const minLabelH = expanded ? 22 : 28;
        return (
          <g key={`p-${i}`}>
            <rect
              x={pad + p.xMm}
              y={pad + grainBand + p.yMm}
              width={p.widthMm}
              height={p.heightMm}
              className={p.grainLocked ? 'sheet-map-part sheet-map-part--grain' : 'sheet-map-part'}
              fill={p.grainLocked ? `url(#${patternId})` : undefined}
            />
            {showPartGrainArrows && p.grainLocked && p.widthMm > 36 && p.heightMm > 16 && (
              <line
                x1={pad + p.xMm + 6}
                y1={cy}
                x2={pad + p.xMm + p.widthMm - 6}
                y2={cy}
                className="sheet-map-part-grain-line"
                strokeWidth={expanded ? 1.4 : 1}
                markerEnd={`url(#${patternId}-arrow)`}
              />
            )}
            {p.widthMm > minLabelW && p.heightMm > minLabelH && (
              <>
                <text
                  x={cx}
                  y={cy - (line2 ? fontSize * 0.45 : 0) - (showPartGrainArrows && p.grainLocked ? fontSize * 0.35 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="sheet-map-label"
                  fontSize={fontSize}
                >
                  {line1}
                </text>
                {line2 && p.heightMm > (expanded ? 36 : 42) && (
                  <text
                    x={cx}
                    y={cy + fontSize * 0.55}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="sheet-map-label sheet-map-label-sub"
                    fontSize={fontSize * 0.85}
                  >
                    {line2}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}

      {!showSheetGrainBand && (
        <text
          x={pad + w - 4}
          y={pad + grainBand + 10}
          textAnchor="end"
          className="sheet-map-grain-arrow"
          fontSize={expanded ? 11 : 9}
        >
          grain →
        </text>
      )}

      {expanded && hasGrainParts && (
        <text x={pad} y={viewH - 3} className="sheet-map-legend-note" fontSize={9}>
          Hatched + arrow on part = grain fixed (along sheet length)
        </text>
      )}
    </svg>
  );
}

type Slide = {
  materialId: string;
  materialName: string;
  sheet: SheetMapSheet;
};

function SheetThumbnail({
  slide,
  patternId,
  onOpen,
}: {
  slide: Slide;
  patternId: string;
  onOpen: () => void;
}) {
  const { sheet } = slide;
  const w = sheet.grainLengthMm;
  const h = sheet.crossLengthMm;

  return (
    <figure className="sheet-map-figure">
      <figcaption className="sheet-map-caption">
        Sheet {sheet.sheetIndex}
        <span className="sheet-map-dims">
          {w} × {h} mm <span className="sheet-map-grain-hint">(tap to enlarge)</span>
        </span>
      </figcaption>
      <button type="button" className="sheet-map-thumb-btn" onClick={onOpen} aria-label={`Open sheet ${sheet.sheetIndex} full screen`}>
        <SheetDiagramSvg sheet={sheet} patternId={patternId} />
      </button>
    </figure>
  );
}

function SheetMapLightbox({
  slides,
  index,
  onClose,
  onChangeIndex,
}: {
  slides: Slide[];
  index: number;
  onClose: () => void;
  onChangeIndex: (next: number) => void;
}) {
  const slide = slides[index];
  const total = slides.length;
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onChangeIndex(index - 1);
  }, [hasPrev, index, onChangeIndex]);

  const goNext = useCallback(() => {
    if (hasNext) onChangeIndex(index + 1);
  }, [hasNext, index, onChangeIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goPrev, goNext]);

  const patternId = `grain-fs-${slide.materialId}-${slide.sheet.sheetIndex}-${index}`;

  return (
    <div className="sheet-map-lightbox" role="dialog" aria-modal="true" aria-labelledby="sheet-map-lightbox-title">
      <button type="button" className="sheet-map-lightbox-scrim" onClick={onClose} aria-label="Close full screen view" />
      <div className="sheet-map-lightbox-panel">
        <header className="sheet-map-lightbox-header">
          <div className="sheet-map-lightbox-titles">
            <h3 id="sheet-map-lightbox-title" className="sheet-map-lightbox-title">
              {slide.materialName}
            </h3>
            <p className="sheet-map-lightbox-meta">
              Sheet {slide.sheet.sheetIndex} · {slide.sheet.grainLengthMm} × {slide.sheet.crossLengthMm} mm · View{' '}
              {index + 1} of {total}
            </p>
          </div>
          <button type="button" className="btn btn-ghost sheet-map-lightbox-close" onClick={onClose}>
            Close ✕
          </button>
        </header>

        <div className="sheet-map-lightbox-body">
          <button
            type="button"
            className="sheet-map-lightbox-nav sheet-map-lightbox-nav--prev"
            onClick={goPrev}
            disabled={!hasPrev}
            aria-label="Previous sheet"
          >
            ‹
          </button>

          <div className="sheet-map-lightbox-canvas">
            <SheetDiagramSvg
              sheet={slide.sheet}
              patternId={patternId}
              expanded
              showSheetGrainBand
              showPartGrainArrows
              className="sheet-map-svg--fullscreen"
            />
          </div>

          <button
            type="button"
            className="sheet-map-lightbox-nav sheet-map-lightbox-nav--next"
            onClick={goNext}
            disabled={!hasNext}
            aria-label="Next sheet"
          >
            ›
          </button>
        </div>

        <footer className="sheet-map-lightbox-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={goPrev} disabled={!hasPrev}>
            ← Previous
          </button>
          <span className="sheet-map-lightbox-foot-hint">Esc to close · ← → to navigate</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={goNext} disabled={!hasNext}>
            Next →
          </button>
        </footer>
      </div>
    </div>
  );
}

interface Props {
  groups: SheetMapGroup[];
}

export function SheetMapView({ groups }: Props) {
  const slides = useMemo((): Slide[] => {
    const list: Slide[] = [];
    for (const group of groups) {
      for (const sheet of group.sheets) {
        list.push({
          materialId: group.materialId,
          materialName: group.materialName,
          sheet,
        });
      }
    }
    return list;
  }, [groups]);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openSlide = (materialId: string, sheetIndex: number) => {
    const i = slides.findIndex((s) => s.materialId === materialId && s.sheet.sheetIndex === sheetIndex);
    if (i >= 0) setLightboxIndex(i);
  };

  if (groups.length === 0) return null;

  return (
    <>
      <div className="sheet-map-view">
        {groups.map((group) => (
          <div key={group.materialId} className="sheet-map-material">
            <h4 className="subsection-title">{group.materialName}</h4>
            <div className="sheet-map-grid">
              {group.sheets.map((sheet) => (
                <SheetThumbnail
                  key={sheet.sheetIndex}
                  slide={{ materialId: group.materialId, materialName: group.materialName, sheet }}
                  patternId={`grain-${group.materialId}-${sheet.sheetIndex}`}
                  onOpen={() => openSlide(group.materialId, sheet.sheetIndex)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {lightboxIndex !== null && slides[lightboxIndex] && (
        <SheetMapLightbox
          slides={slides}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
      )}
    </>
  );
}

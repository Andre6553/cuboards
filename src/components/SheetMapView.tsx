import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SheetMapGroup, SheetMapSheet } from '../types';

const MIN_ZOOM = 1;
const MAX_ZOOM = 10;

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function fitFontSize(label: string, boxW: number, boxH: number, scale = 1): number {
  const base = Math.min(boxW, boxH) * 0.22 * scale;
  const lenFactor = Math.max(1, label.length / 14);
  return Math.max(5, Math.min(scale > 1 ? 20 : 14, base / lenFactor));
}

/** Rip (horizontal) and crosscut (vertical) guides from panel-saw strip layout. */
function guillotineCutLines(placements: SheetMapSheet['placements']): {
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

type DiagramProps = {
  sheet: SheetMapSheet;
  patternId: string;
  /** Larger labels and part grain arrows (fullscreen). */
  expanded?: boolean;
  showSheetGrainBand?: boolean;
  showPartGrainArrows?: boolean;
  className?: string;
  /** Render SVG at this pixel width (crisp zoom — no CSS scale). */
  pixelWidth?: number;
};

function SheetDiagramSvg({
  sheet,
  patternId,
  expanded = false,
  showSheetGrainBand = false,
  showPartGrainArrows = false,
  className = '',
  pixelWidth,
}: DiagramProps) {
  const w = sheet.grainLengthMm;
  const h = sheet.crossLengthMm;
  const pad = expanded ? 14 : 8;
  const grainBand = showSheetGrainBand ? 22 : 0;
  const viewW = w + pad * 2;
  const viewH = h + pad * 2 + grainBand;

  const hasGrainParts = sheet.placements.some((p) => p.grainLocked);
  const cuts = guillotineCutLines(sheet.placements);
  const cutStroke = expanded ? 1.2 : 0.75;

  return (
    <svg
      className={`sheet-map-svg ${className}`.trim()}
      viewBox={`0 0 ${viewW} ${viewH}`}
      width={pixelWidth}
      style={pixelWidth ? { width: pixelWidth, height: 'auto', maxWidth: 'none' } : undefined}
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
        const fontSize = fitFontSize(p.label, p.widthMm, p.heightMm, expanded ? 1.85 : 1);
        const cx = pad + p.xMm + p.widthMm / 2;
        const cy = pad + grainBand + p.yMm + p.heightMm / 2;
        const lines = p.label.split(' · ');
        const line1 = lines[0] ?? p.label;
        const line2 = lines[1];
        const minLabelW = expanded ? 28 : 55;
        const minLabelH = expanded ? 16 : 28;
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

      <g className="sheet-map-cut-guides" aria-hidden>
        {cuts.ripY.map((y, i) => (
          <line
            key={`rip-${i}`}
            x1={pad}
            y1={pad + grainBand + y}
            x2={pad + w}
            y2={pad + grainBand + y}
            className="sheet-map-cut-line sheet-map-cut-line--rip"
            strokeWidth={cutStroke}
          />
        ))}
        {cuts.cross.map((c, i) => (
          <line
            key={`cross-${i}`}
            x1={pad + c.x}
            y1={pad + grainBand + c.y}
            x2={pad + c.x}
            y2={pad + grainBand + c.y + c.h}
            className="sheet-map-cut-line sheet-map-cut-line--cross"
            strokeWidth={cutStroke}
          />
        ))}
      </g>

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
      <button
        type="button"
        className="sheet-map-thumb-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }}
        aria-label={`Open sheet ${sheet.sheetIndex} full screen`}
      >
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

  const canvasRef = useRef<HTMLDivElement>(null);
  const [fitWidth, setFitWidth] = useState(640);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const pad = 14;
  const grainBand = 22;
  const viewW = slide.sheet.grainLengthMm + pad * 2;
  const viewH = slide.sheet.crossLengthMm + pad * 2 + grainBand;
  const viewAspect = viewH / viewW;

  const contentWidth = fitWidth * zoom;
  const contentHeight = contentWidth * viewAspect;

  const measureFit = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const inset = 8;
    const availW = el.clientWidth - inset * 2;
    const availH = el.clientHeight - inset * 2;
    if (availW < 80 || availH < 80) return;
    const widthIfFull = availW;
    const widthIfHeightLimited = availH / viewAspect;
    setFitWidth(Math.max(200, Math.min(widthIfFull, widthIfHeightLimited)));
  }, [viewAspect]);

  useLayoutEffect(() => {
    measureFit();
    const id = requestAnimationFrame(() => measureFit());
    const el = canvasRef.current;
    if (!el) return () => cancelAnimationFrame(id);
    const ro = new ResizeObserver(() => measureFit());
    ro.observe(el);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [index, measureFit]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const applyZoomStep = useCallback(
    (factor: number, focal?: { x: number; y: number }) => {
      const el = canvasRef.current;
      const px = focal?.x ?? (el ? el.clientWidth / 2 : 0);
      const py = focal?.y ?? (el ? el.clientHeight / 2 : 0);
      setZoom((prevZoom) => {
        const nextZoom = clampZoom(prevZoom * factor);
        if (nextZoom <= MIN_ZOOM) {
          setPan({ x: 0, y: 0 });
          return MIN_ZOOM;
        }
        const oldW = fitWidth * prevZoom;
        const oldH = oldW * viewAspect;
        const newW = fitWidth * nextZoom;
        const newH = newW * viewAspect;
        setPan((prevPan) => {
          const fx = oldW > 0 ? (px - prevPan.x) / oldW : 0;
          const fy = oldH > 0 ? (py - prevPan.y) / oldH : 0;
          return { x: px - fx * newW, y: py - fy * newH };
        });
        return nextZoom;
      });
    },
    [fitWidth, viewAspect],
  );

  const goPrev = useCallback(() => {
    if (hasPrev) onChangeIndex(index - 1);
  }, [hasPrev, index, onChangeIndex]);

  const goNext = useCallback(() => {
    if (hasNext) onChangeIndex(index + 1);
  }, [hasNext, index, onChangeIndex]);

  useEffect(() => {
    resetView();
  }, [index, resetView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && !e.shiftKey) goPrev();
      if (e.key === 'ArrowRight' && !e.shiftKey) goNext();
      if (e.key === '+' || e.key === '=') applyZoomStep(1.15);
      if (e.key === '-') applyZoomStep(1 / 1.15);
      if (e.key === '0') resetView();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goPrev, goNext, applyZoomStep, resetView]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      applyZoomStep(factor, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [index, applyZoomStep]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || zoom <= MIN_ZOOM) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  };

  const patternId = `grain-fs-${slide.materialId}-${slide.sheet.sheetIndex}-${index}`;
  const zoomPct = Math.round(zoom * 100);
  const centered = zoom <= MIN_ZOOM && pan.x === 0 && pan.y === 0;

  const lightbox = (
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
          <div className="sheet-map-lightbox-stage">
            <button
              type="button"
              className="sheet-map-lightbox-nav sheet-map-lightbox-nav--overlay sheet-map-lightbox-nav--prev"
              onClick={goPrev}
              disabled={!hasPrev}
              aria-label="Previous sheet"
            >
              ‹
            </button>

            <div
              ref={canvasRef}
              className={`sheet-map-lightbox-canvas${dragging ? ' sheet-map-lightbox-canvas--dragging' : ''}${centered ? ' sheet-map-lightbox-canvas--centered' : ''}${zoom > MIN_ZOOM ? ' sheet-map-lightbox-canvas--zoomed' : ''}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={resetView}
            >
              <div
                className="sheet-map-zoom-layer"
                style={{
                  width: contentWidth,
                  height: contentHeight,
                  ...(centered ? {} : { transform: `translate(${pan.x}px, ${pan.y}px)` }),
                }}
              >
                <SheetDiagramSvg
                  sheet={slide.sheet}
                  patternId={patternId}
                  expanded
                  showSheetGrainBand
                  showPartGrainArrows
                  className="sheet-map-svg--fullscreen"
                  pixelWidth={contentWidth}
                />
              </div>
            </div>

            <button
              type="button"
              className="sheet-map-lightbox-nav sheet-map-lightbox-nav--overlay sheet-map-lightbox-nav--next"
              onClick={goNext}
              disabled={!hasNext}
              aria-label="Next sheet"
            >
              ›
            </button>
          </div>
        </div>

        <footer className="sheet-map-lightbox-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={goPrev} disabled={!hasPrev}>
            ← Previous
          </button>
          <div className="sheet-map-zoom-controls">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyZoomStep(1 / 1.2)} aria-label="Zoom out">
              −
            </button>
            <span className="sheet-map-zoom-readout">{zoomPct}%</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyZoomStep(1.2)} aria-label="Zoom in">
              +
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetView} disabled={zoom <= 1 && pan.x === 0 && pan.y === 0}>
              Fit
            </button>
          </div>
          <span className="sheet-map-lightbox-foot-hint">Scroll to zoom · drag to pan · double-click fit</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={goNext} disabled={!hasNext}>
            Next →
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(lightbox, document.body);
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

      {lightboxIndex !== null && slides[lightboxIndex]
        ? (
          <SheetMapLightbox
            slides={slides}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onChangeIndex={setLightboxIndex}
          />
        )
        : null}
    </>
  );
}

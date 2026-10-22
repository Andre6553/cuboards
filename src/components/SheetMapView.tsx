import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildSheetMapSvg } from '../lib/sheetMapDiagram';
import type { SheetMapGroup, SheetMapSheet } from '../types';

const MIN_ZOOM = 1;
const MAX_ZOOM = 10;

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
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
  const markup = useMemo(
    () =>
      buildSheetMapSvg(sheet, patternId, {
        expanded,
        showSheetGrainBand,
        showPartGrainArrows,
        className: `sheet-map-svg ${className}`.trim(),
        pixelWidth,
      }),
    [sheet, patternId, expanded, showSheetGrainBand, showPartGrainArrows, className, pixelWidth],
  );

  return (
    <div
      className="sheet-map-svg-host"
      style={pixelWidth ? { width: pixelWidth, maxWidth: 'none' } : undefined}
      // SVG is generated locally from cut-list data (not user HTML).
      dangerouslySetInnerHTML={{ __html: markup }}
    />
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

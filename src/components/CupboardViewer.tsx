import { useEffect, useState } from 'react';
import { isSpiceCupboard, plinthHasKickplate, showsKickplate } from '../lib/constants';
import type { Material, Unit } from '../types';
import { ReferenceGraphicView } from './graphics/ReferenceGraphicView';
import { GRAPHIC_VIEWS, SHELF_VARIANTS, SPICE_VIEW_HINT, VIEW_HINTS, type GraphicView, type ShelfVariant } from './graphics/types';

interface Props {
  unit: Unit;
  thickness: number;
  materials: Material[];
  /** Keeps carcass graphic in sync with Shelves section / cut list. */
  onShelfQtyChange: (qty: number) => void;
}

export function CupboardViewer({ unit, thickness, onShelfQtyChange }: Props) {
  const [view, setView] = useState<GraphicView>('front');
  const spiceMount = isSpiceCupboard(unit);
  const shelfVariant: ShelfVariant = (unit.carcass.shelfQty ?? 0) > 0 ? 'with-shelf' : 'no-shelf';
  const kh =
    showsKickplate(unit) && unit.plinth && plinthHasKickplate(unit.plinth)
      ? unit.plinth.kickplateHeight
      : 0;
  const previewVariant: ShelfVariant = spiceMount ? 'spice' : shelfVariant;
  const showingSpice = spiceMount && view === '3d';

  useEffect(() => {
    if (spiceMount) setView('3d');
  }, [spiceMount, unit.id]);

  return (
    <div className="cupboard-viewer">
      <div className="viewer-header">
        <h3>Carcass preview</h3>
        {unit.unitQty > 1 && <span className="viewer-badge">×{unit.unitQty} cupboards</span>}
        <div className="view-tabs">
          {GRAPHIC_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`view-tab ${view === v.id ? 'active' : ''}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {!spiceMount && (
        <div className="viewer-shelf-bar">
          <span className="viewer-shelf-label">Carcass graphic</span>
          <div className="view-tabs view-tabs-compact">
            {SHELF_VARIANTS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`view-tab ${shelfVariant === v.id ? 'active' : ''}`}
                onClick={() => {
                  if (v.id === 'no-shelf') {
                    onShelfQtyChange(0);
                  } else {
                    const current = unit.carcass.shelfQty ?? 0;
                    onShelfQtyChange(current > 0 ? current : 1);
                  }
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <ReferenceGraphicView view={view} shelfVariant={previewVariant} unit={unit} thickness={thickness} />

      <div className="viewer-footer">
        <span className="viewer-size">
          {unit.width} W × {unit.height} H × {unit.depth} D mm · {thickness}mm board
          {kh > 0 ? ` · ${kh}mm kick` : ''}
        </span>
        <span className="viewer-ref-hint">{showingSpice ? SPICE_VIEW_HINT : VIEW_HINTS[view]}</span>
      </div>
    </div>
  );
}

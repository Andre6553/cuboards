import { useEffect, useState } from 'react';
import { isKitchenBase } from '../lib/constants';
import type { Material, Unit } from '../types';
import { ReferenceGraphicView } from './graphics/ReferenceGraphicView';
import { GRAPHIC_VIEWS, SHELF_VARIANTS, VIEW_HINTS, type GraphicView, type ShelfVariant } from './graphics/types';

interface Props {
  unit: Unit;
  thickness: number;
  materials: Material[];
}

function defaultShelfVariant(unit: Unit): ShelfVariant {
  return unit.carcass.shelfQty > 0 ? 'with-shelf' : 'no-shelf';
}

export function CupboardViewer({ unit, thickness }: Props) {
  const [view, setView] = useState<GraphicView>('front');
  const [shelfVariant, setShelfVariant] = useState<ShelfVariant>(() => defaultShelfVariant(unit));
  const kh = isKitchenBase(unit.type) && unit.plinth ? unit.plinth.kickplateHeight : 0;

  useEffect(() => {
    setShelfVariant(defaultShelfVariant(unit));
  }, [unit.id, unit.carcass.shelfQty]);

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

      <div className="viewer-shelf-bar">
        <span className="viewer-shelf-label">Shelf graphic</span>
        <div className="view-tabs view-tabs-compact">
          {SHELF_VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`view-tab ${shelfVariant === v.id ? 'active' : ''}`}
              onClick={() => setShelfVariant(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <ReferenceGraphicView view={view} shelfVariant={shelfVariant} unit={unit} thickness={thickness} />

      <div className="viewer-footer">
        <span className="viewer-size">
          {unit.width} W × {unit.height} H × {unit.depth} D mm · {thickness}mm board
          {kh > 0 ? ` · ${kh}mm kick` : ''}
        </span>
        <span className="viewer-ref-hint">{VIEW_HINTS[view]}</span>
      </div>
    </div>
  );
}

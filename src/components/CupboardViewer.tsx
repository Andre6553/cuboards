import { useEffect, useState } from 'react';
import {
  isFloorCorner,
  isSpiceCupboard,
  isTallFloor,
  isWallCorner,
  plinthHasKickplate,
  showsKickplate,
} from '../lib/constants';
import type { Material, Unit } from '../types';
import { ReferenceGraphicView } from './graphics/ReferenceGraphicView';
import {
  FLOOR_CORNER_VIEW_HINT,
  GRAPHIC_VIEWS,
  SHELF_VARIANTS,
  SPICE_VIEW_HINT,
  TALL_VIEW_HINT,
  VIEW_HINTS,
  WALL_CORNER_VIEW_HINT,
  WALL_VIEW_HINT,
  type GraphicView,
  type ShelfVariant,
} from './graphics/types';

interface Props {
  unit: Unit;
  thickness: number;
  materials: Material[];
  /** Keeps carcass graphic in sync with Shelves section / cut list. */
  onShelfQtyChange: (qty: number) => void;
}

function isWallMountSelected(unit: Unit): boolean {
  return (unit.carcass?.mountType ?? (unit.type === 'wall' ? 'wall' : 'floor')) === 'wall';
}

function resolvePreviewVariant(unit: Unit): ShelfVariant {
  if (isSpiceCupboard(unit)) return 'spice';
  if (isFloorCorner(unit)) return 'floor-corner';
  if (isWallCorner(unit)) return 'wall-corner';
  if (isTallFloor(unit)) return 'tall';
  if (isWallMountSelected(unit)) return 'wall';
  return (unit.carcass.shelfQty ?? 0) > 0 ? 'with-shelf' : 'no-shelf';
}

function previewHint(unit: Unit, view: GraphicView, spiceOn3d: boolean): string {
  if (spiceOn3d) return SPICE_VIEW_HINT;
  if (isFloorCorner(unit)) return FLOOR_CORNER_VIEW_HINT;
  if (isWallCorner(unit)) return WALL_CORNER_VIEW_HINT;
  if (isTallFloor(unit)) return TALL_VIEW_HINT;
  if (isWallMountSelected(unit)) return WALL_VIEW_HINT;
  return VIEW_HINTS[view];
}

export function CupboardViewer({ unit, thickness, onShelfQtyChange }: Props) {
  const [view, setView] = useState<GraphicView>('front');
  const previewVariant = resolvePreviewVariant(unit);
  const shelfVariant: ShelfVariant = (unit.carcass.shelfQty ?? 0) > 0 ? 'with-shelf' : 'no-shelf';
  const fixedMountPhoto =
    previewVariant === 'spice' ||
    previewVariant === 'wall' ||
    previewVariant === 'tall' ||
    previewVariant === 'floor-corner' ||
    previewVariant === 'wall-corner';
  const kh =
    showsKickplate(unit) && unit.plinth && plinthHasKickplate(unit.plinth)
      ? unit.plinth.kickplateHeight
      : 0;
  const showingSpice = previewVariant === 'spice' && view === '3d';

  useEffect(() => {
    if (fixedMountPhoto) setView('3d');
  }, [fixedMountPhoto, unit.id, previewVariant]);

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

      {!fixedMountPhoto && (
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
        <span className="viewer-ref-hint">{previewHint(unit, view, showingSpice)}</span>
      </div>
    </div>
  );
}

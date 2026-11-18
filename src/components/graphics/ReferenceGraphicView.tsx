import { plinthHasKickplate, showsKickplate } from '../../lib/constants';
import type { GraphicProps, ShelfVariant } from './types';
import { getReferenceImage } from './types';

interface Props extends GraphicProps {
  view: import('./types').GraphicView;
  shelfVariant: ShelfVariant;
}

function altForVariant(view: string, shelfVariant: ShelfVariant): string {
  switch (shelfVariant) {
    case 'bedroom':
      return 'Bedroom cupboard';
    case 'spice':
      return 'Spice cupboard 3D';
    case 'tall':
      return 'Tall floor carcass 3D';
    case 'wall':
      return 'Wall mount carcass 3D';
    case 'floor-corner':
      return 'Floor corner carcass 3D';
    case 'wall-corner':
      return 'Wall corner carcass 3D';
    default:
      return `${view} carcass reference — ${shelfVariant}`;
  }
}

/** Displays the installer's reference photo for the selected view and shelf / mount variant. */
export function ReferenceGraphicView({ view, shelfVariant, unit, thickness }: Props) {
  const src = getReferenceImage(view, shelfVariant);
  const bedroom = shelfVariant === 'bedroom';
  const spice = shelfVariant === 'spice';
  const wall = shelfVariant === 'wall';
  const tall = shelfVariant === 'tall';
  const floorCorner = shelfVariant === 'floor-corner';
  const wallCorner = shelfVariant === 'wall-corner';
  const kh =
    showsKickplate(unit) && unit.plinth && plinthHasKickplate(unit.plinth)
      ? unit.plinth.kickplateHeight
      : 0;
  const internalW = unit.width - 2 * thickness;
  const internalD = unit.depth - 2 * thickness;
  const shelfQty = Math.max(0, unit.carcass.shelfQty ?? 0);
  const previewHasShelf = shelfVariant === 'with-shelf';

  return (
    <div className="reference-viewer">
      {src ? (
        <img src={src} alt={altForVariant(view, shelfVariant)} className="reference-image" />
      ) : (
        <p className="ref-note spice-view-note">Spice cupboard drawing is on the 3D view.</p>
      )}
      {src && !spice && (
        <div className="reference-dims">
          <span className="ref-dim ref-dim-w">{unit.width} mm</span>
          <span className="ref-dim ref-dim-h">{unit.height} mm</span>
          <span className="ref-dim ref-dim-d">{unit.depth} mm</span>
        </div>
      )}
      <div className="reference-meta">
        {bedroom && <span>Bedroom cupboard</span>}
        {spice && view === '3d' && (
          <span>Spice mount — carcass without shelf; spice panels on cut list</span>
        )}
        {tall && <span>Tall floor — wall-style carcass with plinth</span>}
        {wall && <span>Wall mount — full top panel</span>}
        {floorCorner && <span>Floor corner — fixed L-shape panels</span>}
        {wallCorner && <span>Wall corner — fixed L-shape panels</span>}
        {previewHasShelf && shelfQty > 0 && (
          <span>
            {shelfQty} shelf{shelfQty > 1 ? 's' : ''} on cut list
            {' · '}internal {internalW} × {internalD} mm
          </span>
        )}
        {kh > 0 && <span>Kick {kh} mm</span>}
      </div>
    </div>
  );
}

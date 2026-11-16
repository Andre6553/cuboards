import { plinthHasKickplate, showsKickplate } from '../../lib/constants';
import type { GraphicProps, GraphicView, ShelfVariant } from './types';
import { getReferenceImage } from './types';

interface Props extends GraphicProps {
  view: GraphicView;
  shelfVariant: ShelfVariant;
}

/** Displays the installer's reference PNG for the selected view and shelf variant. */
export function ReferenceGraphicView({ view, shelfVariant, unit, thickness }: Props) {
  const src = getReferenceImage(view, shelfVariant);
  const spice = shelfVariant === 'spice';
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
        <img
          src={src}
          alt={spice ? 'Spice cupboard 3D' : `${view} carcass reference — ${shelfVariant}`}
          className="reference-image"
        />
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
        {spice && view === '3d' && (
          <span>Spice mount — carcass without shelf; spice panels on cut list</span>
        )}
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

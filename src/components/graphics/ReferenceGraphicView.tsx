import { isKitchenBase } from '../../lib/constants';
import type { GraphicProps, GraphicView, ShelfVariant } from './types';
import { getReferenceImage } from './types';

interface Props extends GraphicProps {
  view: GraphicView;
  shelfVariant: ShelfVariant;
}

/** Displays the installer's reference PNG for the selected view and shelf variant. */
export function ReferenceGraphicView({ view, shelfVariant, unit, thickness }: Props) {
  const src = getReferenceImage(view, shelfVariant);
  const kh = isKitchenBase(unit.type) && unit.plinth ? unit.plinth.kickplateHeight : 0;
  const internalW = unit.width - 2 * thickness;
  const internalD = unit.depth - 2 * thickness;
  const configHasShelf = unit.carcass.shelfQty > 0;
  const previewHasShelf = shelfVariant === 'with-shelf';

  return (
    <div className="reference-viewer">
      <img
        src={src}
        alt={`${view} carcass reference — ${shelfVariant}`}
        className="reference-image"
      />
      <div className="reference-dims">
        <span className="ref-dim ref-dim-w">{unit.width} mm</span>
        <span className="ref-dim ref-dim-h">{unit.height} mm</span>
        <span className="ref-dim ref-dim-d">{unit.depth} mm</span>
      </div>
      <div className="reference-meta">
        {previewHasShelf && (
          <span>
            {unit.carcass.shelfQty > 0
              ? `${unit.carcass.shelfQty} shelf${unit.carcass.shelfQty > 1 ? 's' : ''} in cut list`
              : 'Preview only — no shelves in cut list'}
            {' · '}internal {internalW} × {internalD} mm
          </span>
        )}
        {!previewHasShelf && configHasShelf && (
          <span className="ref-note">Cut list has {unit.carcass.shelfQty} shelf{unit.carcass.shelfQty > 1 ? 's' : ''} — showing no-shelf graphic</span>
        )}
        {kh > 0 && <span>Kick {kh} mm</span>}
      </div>
    </div>
  );
}

import type { Unit } from '../../types';

/** Four views matching the installer's reference graphics. */
export type GraphicView = 'front' | 'left' | 'right' | '3d';

export const GRAPHIC_VIEWS: { id: GraphicView; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: '3d', label: '3D' },
];

export interface GraphicProps {
  unit: Unit;
  thickness: number;
}

export type ShelfVariant = 'no-shelf' | 'with-shelf' | 'spice';

export const SHELF_VARIANTS: { id: ShelfVariant; label: string }[] = [
  { id: 'no-shelf', label: 'No shelf' },
  { id: 'with-shelf', label: 'With shelf' },
];

/** Shown on the 3D tab when the spice cupboard graphic is selected. */
export const SPICE_CUPBOARD_3D = '/graphics/spice-cupboard-3d.png';

/** Reference PNG for view + shelf variant. Spice cupboard only has a 3D drawing. */
export function getReferenceImage(view: GraphicView, variant: ShelfVariant): string | null {
  if (variant === 'spice') {
    return view === '3d' ? SPICE_CUPBOARD_3D : null;
  }
  const withShelf = variant === 'with-shelf';
  const map: Record<GraphicView, [string, string]> = {
    front: ['/graphics/front-carcass.png', '/graphics/front-carcass-with-shelf.png'],
    left: ['/graphics/left-carcass-no-shelf.png', '/graphics/left-carcass-with-shelf.png'],
    right: ['/graphics/right-carcass-no-shelf.png', '/graphics/right-carcass-with-shelf.png'],
    '3d': ['/graphics/iso-no-shelf.png', '/graphics/iso-with-shelf.png'],
  };
  return map[view][withShelf ? 1 : 0];
}

export const VIEW_HINTS: Record<GraphicView, string> = {
  front: 'Your front reference graphic',
  left: 'Your left reference graphic',
  right: 'Your right reference graphic',
  '3d': 'Your 3D isometric reference graphic',
};

export const SPICE_VIEW_HINT = 'Spice cupboard mount — 3D reference. Cut sizes come next.';

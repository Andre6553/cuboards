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

export type ShelfVariant =
  | 'no-shelf'
  | 'with-shelf'
  | 'spice'
  | 'wall'
  | 'tall'
  | 'floor-corner'
  | 'wall-corner'
  | 'bedroom';

export const SHELF_VARIANTS: { id: ShelfVariant; label: string }[] = [
  { id: 'no-shelf', label: 'No shelf' },
  { id: 'with-shelf', label: 'With shelf' },
];

/** Shown on the 3D tab when the spice cupboard graphic is selected. */
export const SPICE_CUPBOARD_3D = '/graphics/spice.jpg';

/** Photoreal carcass references (same photo for Front/Left/Right/3D until view-specific art exists). */
export const CARCASS_NO_SHELF_3D = '/graphics/no_Shelf.jpg';
export const CARCASS_WITH_SHELF_3D = '/graphics/with_Shelf.jpg';
export const WALL_MOUNT_3D = '/graphics/wall.jpg';
export const TALL_FLOOR_3D = '/graphics/tall.jpg';
export const FLOOR_CORNER_3D = '/graphics/corner_floor.jpg';
export const WALL_CORNER_3D = '/graphics/corner_wall.jpg';
export const BEDROOM_3D = '/graphics/bedroom.jpg';

/** Reference image for view + shelf / mount variant. Mount-specific photos ignore shelf toggles. */
export function getReferenceImage(view: GraphicView, variant: ShelfVariant): string | null {
  if (variant === 'spice') {
    return view === '3d' ? SPICE_CUPBOARD_3D : null;
  }
  if (variant === 'bedroom') return BEDROOM_3D;
  if (variant === 'wall') return WALL_MOUNT_3D;
  if (variant === 'tall') return TALL_FLOOR_3D;
  if (variant === 'floor-corner') return FLOOR_CORNER_3D;
  if (variant === 'wall-corner') return WALL_CORNER_3D;
  return variant === 'with-shelf' ? CARCASS_WITH_SHELF_3D : CARCASS_NO_SHELF_3D;
}

export const VIEW_HINTS: Record<GraphicView, string> = {
  front: 'Your front reference graphic',
  left: 'Your left reference graphic',
  right: 'Your right reference graphic',
  '3d': 'Your 3D isometric reference graphic',
};

export const SPICE_VIEW_HINT = 'Spice cupboard mount — 3D reference. Cut sizes come next.';
export const WALL_VIEW_HINT = 'Wall mount — 3D reference (full top, no floor kickplate).';
export const TALL_VIEW_HINT = 'Tall floor unit — wall-style carcass with plinth.';
export const FLOOR_CORNER_VIEW_HINT = 'Floor corner — fixed L-shape cut sizes.';
export const WALL_CORNER_VIEW_HINT = 'Wall corner — fixed L-shape cut sizes.';
export const BEDROOM_VIEW_HINT = 'Bedroom cupboard — reference photo.';

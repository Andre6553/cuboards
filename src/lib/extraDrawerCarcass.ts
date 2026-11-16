import type { BedroomWallExtra } from '../types';

/** Drawer stack carcass W×H×D — the box drawers sit in (not the outer extra carcass). */
export function extraDrawerCarcassSize(extra: BedroomWallExtra): { width: number; height: number; depth: number } {
  return {
    width: Math.max(1, Math.round(extra.drawerCarcassWidth || extra.width)),
    height: Math.max(1, Math.round(extra.drawerCarcassHeight || extra.height)),
    depth: Math.max(1, Math.round(extra.drawerCarcassDepth || extra.depth)),
  };
}
import type { CutPiece, MasoniteConfig, SheetPurchaseUnit, Unit } from '../types';
import { DEFAULT_SHEET_PURCHASE_UNIT } from './sheetCost';

export type MasoniteSheetSizeLabel = 'small' | 'large';

export interface ResolvedMasoniteSheet {
  label: MasoniteSheetSizeLabel;
  width: number;
  height: number;
  pricePerSheet: number;
  colour: string;
  thickness: number;
  sheetPurchaseUnit: SheetPurchaseUnit;
  /** Explicit cut-house for this size (may be empty — caller applies job defaults). */
  orderFromSupplier: string;
  /** Why large was chosen (empty when small). */
  reason: string;
}

export const DEFAULT_SMALL_MASONITE_W = 2440;
export const DEFAULT_SMALL_MASONITE_H = 1220;
export const DEFAULT_LARGE_MASONITE_W = 2750;
export const DEFAULT_LARGE_MASONITE_H = 1830;
export const DEFAULT_LARGE_MASONITE_PRICE = 475;

export function resolveSmallMasoniteSheet(masonite: MasoniteConfig): {
  width: number;
  height: number;
  pricePerSheet: number;
} {
  return {
    width: Math.max(1, masonite.sheetWidth ?? DEFAULT_SMALL_MASONITE_W),
    height: Math.max(1, masonite.sheetHeight ?? DEFAULT_SMALL_MASONITE_H),
    pricePerSheet: masonite.pricePerSheet,
  };
}

export function resolveLargeMasoniteSheet(masonite: MasoniteConfig): {
  width: number;
  height: number;
  pricePerSheet: number;
} {
  return {
    width: Math.max(1, masonite.largeSheetWidth ?? DEFAULT_LARGE_MASONITE_W),
    height: Math.max(1, masonite.largeSheetHeight ?? DEFAULT_LARGE_MASONITE_H),
    pricePerSheet: masonite.largePricePerSheet ?? DEFAULT_LARGE_MASONITE_PRICE,
  };
}

/** Effective colour / thickness / buy-as / cut-house for a chosen sheet size. */
export function resolveMasoniteSheetIdentity(
  masonite: MasoniteConfig,
  label: MasoniteSheetSizeLabel,
): {
  colour: string;
  thickness: number;
  sheetPurchaseUnit: SheetPurchaseUnit;
  orderFromSupplier: string;
} {
  if (label === 'large') {
    const colour = (masonite.largeColour ?? masonite.colour ?? '').trim() || masonite.colour;
    const thickness =
      masonite.largeThickness != null && Number.isFinite(masonite.largeThickness)
        ? masonite.largeThickness
        : masonite.thickness;
    return {
      colour,
      thickness,
      sheetPurchaseUnit:
        masonite.largeSheetPurchaseUnit ?? masonite.sheetPurchaseUnit ?? DEFAULT_SHEET_PURCHASE_UNIT,
      orderFromSupplier: (masonite.largeOrderFromSupplier ?? masonite.orderFromSupplier ?? '').trim(),
    };
  }
  return {
    colour: masonite.colour,
    thickness: masonite.thickness,
    sheetPurchaseUnit: masonite.sheetPurchaseUnit ?? DEFAULT_SHEET_PURCHASE_UNIT,
    orderFromSupplier: (masonite.orderFromSupplier ?? '').trim(),
  };
}

/** True if a W×L panel fits on sheet (either orientation). */
export function panelFitsOnSheet(
  panelW: number,
  panelL: number,
  sheetW: number,
  sheetH: number,
): boolean {
  const w = Math.max(0, panelW);
  const l = Math.max(0, panelL);
  return (w <= sheetW && l <= sheetH) || (w <= sheetH && l <= sheetW);
}

function resolvedSheet(
  masonite: MasoniteConfig,
  label: MasoniteSheetSizeLabel,
  dims: { width: number; height: number; pricePerSheet: number },
  reason: string,
): ResolvedMasoniteSheet {
  const identity = resolveMasoniteSheetIdentity(masonite, label);
  return {
    label,
    width: dims.width,
    height: dims.height,
    pricePerSheet: dims.pricePerSheet,
    ...identity,
    reason,
  };
}

/**
 * Job-wide masonite sheet pick.
 * Large if total area > small sheet area, or any piece / cupboard height
 * cannot fit on the small sheet (rotation allowed; height vs small long side).
 */
export function resolveMasoniteSheetForJob(
  masonite: MasoniteConfig,
  masonitePieces: Pick<CutPiece, 'width' | 'length' | 'qty'>[],
  units: Pick<Unit, 'height' | 'carcass'>[] = [],
): ResolvedMasoniteSheet {
  const small = resolveSmallMasoniteSheet(masonite);
  const large = resolveLargeMasoniteSheet(masonite);
  const smallArea = small.width * small.height;
  const smallLong = Math.max(small.width, small.height);

  const totalArea = masonitePieces.reduce(
    (sum, p) => sum + Math.max(0, p.width) * Math.max(0, p.length) * Math.max(0, p.qty),
    0,
  );

  if (totalArea > smallArea) {
    return resolvedSheet(
      masonite,
      'large',
      large,
      `total masonite area exceeds small sheet ${small.width}×${small.height}`,
    );
  }

  for (const p of masonitePieces) {
    if (p.qty <= 0) continue;
    if (!panelFitsOnSheet(p.width, p.length, small.width, small.height)) {
      return resolvedSheet(
        masonite,
        'large',
        large,
        `panel ${Math.round(p.width)}×${Math.round(p.length)} does not fit on small sheet`,
      );
    }
  }

  for (const u of units) {
    const backing = u.carcass?.backingType ?? 'none';
    if (backing !== 'masonite') continue;
    if (u.height > smallLong) {
      return resolvedSheet(
        masonite,
        'large',
        large,
        `cupboard height ${u.height} mm taller than small sheet long side ${smallLong} mm`,
      );
    }
  }

  return resolvedSheet(masonite, 'small', small, '');
}

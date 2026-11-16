import type { SpiceCupboardConfig } from '../types';
import { drawerBoxFrontBackWidth } from './drawerBoxRules';

export const DEFAULT_SPICE_FRONT_HEIGHT_MM = 600;
export const DEFAULT_SPICE_RUNNER_SIDE_CLEARANCE_MM = 13;
export const SPICE_FILLER_HEIGHT_MM = 100;

export function defaultSpiceCupboardConfig(carcassHeightMm: number): SpiceCupboardConfig {
  return {
    frontHeightMm: Math.min(DEFAULT_SPICE_FRONT_HEIGHT_MM, Math.max(1, carcassHeightMm)),
    runnerSideClearanceMm: DEFAULT_SPICE_RUNNER_SIDE_CLEARANCE_MM,
  };
}

export function resolveSpiceFrontHeightMm(config: SpiceCupboardConfig | undefined, carcassHeightMm: number): number {
  const raw = config?.frontHeightMm ?? DEFAULT_SPICE_FRONT_HEIGHT_MM;
  const h = Math.max(1, carcassHeightMm);
  return Math.min(Math.max(1, raw), h);
}

export function resolveSpiceRunnerSideClearanceMm(config: SpiceCupboardConfig | undefined): number {
  const c = config?.runnerSideClearanceMm ?? DEFAULT_SPICE_RUNNER_SIDE_CLEARANCE_MM;
  return Math.max(0, c);
}

export interface SpiceCupboardSizes {
  frontWidth: number;
  frontHeight: number;
  splitWidth: number;
  splitHeight: number;
  bottomWidth: number;
  bottomDepth: number;
  shelfWidth: number;
  shelfDepth: number;
  fillerWidth: number;
  fillerHeight: number;
  runnerSideClearance: number;
}

export function calcSpiceCupboardSizes(
  carcassWidth: number,
  carcassHeight: number,
  carcassDepth: number,
  boardThickness: number,
  config: SpiceCupboardConfig | undefined,
): SpiceCupboardSizes {
  const T = boardThickness;
  const runnerSideClearance = resolveSpiceRunnerSideClearanceMm(config);
  const frontHeight = resolveSpiceFrontHeightMm(config, carcassHeight);
  const frontWidth = drawerBoxFrontBackWidth(carcassWidth, T, runnerSideClearance);
  const bottomDepth = Math.max(1, carcassDepth - T);
  const splitWidth = Math.max(1, carcassDepth - 2 * T);
  const splitHeight = Math.max(1, frontHeight - T);
  const shelfWidth = Math.max(1, (frontWidth - T) / 2);
  const shelfDepth = bottomDepth;

  return {
    frontWidth,
    frontHeight,
    splitWidth,
    splitHeight,
    bottomWidth: frontWidth,
    bottomDepth,
    shelfWidth,
    shelfDepth,
    fillerWidth: frontWidth,
    fillerHeight: SPICE_FILLER_HEIGHT_MM,
    runnerSideClearance,
  };
}

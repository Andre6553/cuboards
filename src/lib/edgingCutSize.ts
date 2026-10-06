import type { CutSizeMode, EdgingPattern, Job } from '../types';

export const CUT_SIZE_MODE_LABELS: Record<CutSizeMode, string> = {
  final: 'Final sizes (edging included in dimensions)',
  net: 'Net cut sizes (deduct edging thickness from cut list)',
};

export function getBoardEdgingThickness(job: Job, boardMaterialId: string): number {
  const boardMat = job.materials.find((m) => m.id === boardMaterialId);
  const edgingMat = job.edgingMaterials.find((e) => e.id === boardMat?.edgingMaterialId);
  return edgingMat?.thickness ?? 0;
}

export function resolveEdgingThickness(
  job: Job,
  boardMaterialId: string,
  edgingMaterialIdOverride?: string,
): { thickness: number; name: string; materialId: string } {
  const materialId =
    edgingMaterialIdOverride ??
    job.materials.find((m) => m.id === boardMaterialId)?.edgingMaterialId ??
    '';
  const edgingMat = job.edgingMaterials.find((e) => e.id === materialId);
  return {
    materialId,
    thickness: edgingMat?.thickness ?? 0,
    name: edgingMat?.name ?? '—',
  };
}

export interface PanelCutSizeResult {
  finishedWidth: number;
  finishedHeight: number;
  cutWidth: number;
  cutHeight: number;
  cutSizeMode: CutSizeMode;
  edgingPattern: EdgingPattern;
  edgingName: string;
  edgingThickness: number;
  sizeNote: string;
}

/** Which piece axis the "long" edging run follows. Tape on that edge reduces the other axis. */
export type LongAlong = 'width' | 'length';

export function edgingRunMm(
  pattern: EdgingPattern,
  longEdgeMm: number,
  shortEdgeMm: number,
): number {
  switch (pattern) {
    case '1_long':
      return longEdgeMm;
    case '2_long':
      return longEdgeMm * 2;
    case '1_long_1_short':
      return longEdgeMm + shortEdgeMm;
    case '1_long_2_short':
      return longEdgeMm + shortEdgeMm * 2;
    case '2_long_2_short':
      return (longEdgeMm + shortEdgeMm) * 2;
    default:
      return 0;
  }
}

/** Finished panel size + cut-list board size respecting final vs net mode and edging tape. */
export function panelCutSizes(
  job: Job,
  boardMaterialId: string,
  finishedWidth: number,
  finishedHeight: number,
  pattern: EdgingPattern,
  edgingMaterialIdOverride?: string,
  longAlong: LongAlong = 'length',
): PanelCutSizeResult {
  const { thickness, name } = resolveEdgingThickness(job, boardMaterialId, edgingMaterialIdOverride);
  const sized = applyCutSizeMode(
    job,
    boardMaterialId,
    finishedWidth,
    finishedHeight,
    pattern,
    edgingMaterialIdOverride,
    longAlong,
  );
  const mode = job.settings.cutSizeMode ?? 'final';
  return {
    finishedWidth,
    finishedHeight,
    cutWidth: sized.width,
    cutHeight: sized.length,
    cutSizeMode: mode,
    edgingPattern: pattern,
    edgingName: name,
    edgingThickness: thickness,
    sizeNote: sized.sizeNote,
  };
}

/** Human-readable cut size line for door/drawer summaries. */
export function formatPanelCutSizeSummary(result: PanelCutSizeResult): string {
  const edgingPart =
    result.edgingPattern !== 'none' && result.edgingThickness > 0
      ? ` · Edging ${result.edgingName} (${result.edgingThickness} mm)`
      : '';

  const netBoard =
    result.cutSizeMode === 'net' &&
    result.edgingPattern !== 'none' &&
    result.edgingThickness > 0 &&
    (result.cutWidth !== result.finishedWidth || result.cutHeight !== result.finishedHeight);

  if (netBoard) {
    return (
      `Finished ${result.finishedWidth} × ${result.finishedHeight} mm · ` +
      `Cut list (net board) ${result.cutWidth} × ${result.cutHeight} mm${edgingPart}` +
      (result.sizeNote ? ` · ${result.sizeNote}` : '')
    );
  }

  const modeLabel = result.cutSizeMode === 'net' ? 'net' : 'final';
  return (
    `Finished ${result.finishedWidth} × ${result.finishedHeight} mm · ` +
    `Cut list (${modeLabel}) ${result.cutWidth} × ${result.cutHeight} mm${edgingPart}`
  );
}

/**
 * Reduce finished panel to net board size.
 * `longAlong` is the axis the "long" tape follows (front/top run), not max(width,length).
 */
export function deductEdgingFromDimensions(
  width: number,
  length: number,
  pattern: EdgingPattern,
  thickness: number,
  longAlong: LongAlong = 'length',
): { width: number; length: number } {
  if (pattern === 'none' || thickness <= 0) {
    return { width, length };
  }

  let longDed = 0;
  let shortDed = 0;

  switch (pattern) {
    case '1_long':
      longDed = thickness;
      break;
    case '2_long':
      longDed = thickness * 2;
      break;
    case '1_long_1_short':
      longDed = thickness;
      shortDed = thickness;
      break;
    case '1_long_2_short':
      longDed = thickness;
      shortDed = thickness * 2;
      break;
    case '2_long_2_short':
      longDed = thickness * 2;
      shortDed = thickness * 2;
      break;
    default:
      break;
  }

  // Long tape runs along that axis, so it eats the opposite dimension.
  if (longAlong === 'length') {
    return {
      width: Math.max(0, width - longDed),
      length: Math.max(0, length - shortDed),
    };
  }
  return {
    width: Math.max(0, width - shortDed),
    length: Math.max(0, length - longDed),
  };
}

export function applyCutSizeMode(
  job: Job,
  boardMaterialId: string,
  width: number,
  length: number,
  pattern: EdgingPattern,
  edgingMaterialIdOverride?: string,
  longAlong: LongAlong = 'length',
): { width: number; length: number; sizeNote: string } {
  const mode = job.settings.cutSizeMode ?? 'final';
  if (mode !== 'net' || pattern === 'none') {
    return { width, length, sizeNote: '' };
  }

  const thickness = edgingMaterialIdOverride
    ? (job.edgingMaterials.find((e) => e.id === edgingMaterialIdOverride)?.thickness ?? 0)
    : getBoardEdgingThickness(job, boardMaterialId);
  if (thickness <= 0) {
    return { width, length, sizeNote: '' };
  }

  const adjusted = deductEdgingFromDimensions(width, length, pattern, thickness, longAlong);
  return {
    width: adjusted.width,
    length: adjusted.length,
    sizeNote: `Net cut (−${thickness} mm per edged edge)`,
  };
}

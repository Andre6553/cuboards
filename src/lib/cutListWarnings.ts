import { isFloorUnit } from './constants';
import { isActiveDrawer } from './drawerRules';
import type { Job } from '../types';

export const POSTFORM_TOP_NOTICE =
  'Postform worktops are not included in this quote. Where granite / stone top is not selected, postform tops must be quoted separately.';

/** True when any active floor unit uses wooden / laminate top (not granite). */
export function jobNeedsPostformTopQuote(job: Job): boolean {
  return job.units.some(
    (unit) =>
      (unit.unitQty ?? 0) > 0 &&
      isFloorUnit(unit) &&
      (unit.carcass.countertopType ?? 'granite') !== 'granite',
  );
}

function bottomLabel(bottomType: 'solid' | 'masonite' | undefined): string {
  return bottomType === 'solid' ? 'solid melamine drawer bottoms' : 'masonite drawer bottoms';
}

/** Warn when drawer rows exist but none are on the cut list (qty per cupboard = 0). */
export function getDrawerCutListWarnings(job: Job): string[] {
  const warnings: string[] = [];

  for (const unit of job.units) {
    if ((unit.unitQty ?? 0) <= 0) continue;
    if (unit.drawers.length === 0) continue;

    const active = unit.drawers.filter(isActiveDrawer);
    if (active.length === 0) {
      const bottomTypes = [...new Set(unit.drawers.map((d) => d.bottomType ?? 'masonite'))];
      const bottomHint =
        bottomTypes.length === 1
          ? bottomLabel(bottomTypes[0])
          : 'drawer bottoms';

      warnings.push(
        `${unit.name}: drawer row(s) are configured but Qty per cupboard is 0 — no drawer parts, runners, or ${bottomHint} will appear on the cut list. Open the unit → Drawers → set Qty per cupboard to 1 or more (or click "+ Add drawers" if none exist).`,
      );
      continue;
    }

    if (active.length === 1 && active[0].qty > 1) {
      warnings.push(
        `${unit.name}: Qty ${active[0].qty} on one drawer row cuts ${active[0].qty} matching boxes/fronts, it does not stack ${active[0].qty} different heights. For a drawer tower, click "+ Add drawers" for each row (qty 1 each).`,
      );
    }
  }

  return warnings;
}

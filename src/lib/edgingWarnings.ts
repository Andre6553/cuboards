import { activeDrawers } from './drawerRules';
import type { Job } from '../types';

function edgingThickness(job: Job, edgingMaterialId: string | undefined): number | undefined {
  if (!edgingMaterialId) return undefined;
  return job.edgingMaterials.find((e) => e.id === edgingMaterialId)?.thickness;
}

function formatThicknessList(thicknesses: number[]): string {
  return thicknesses.map((t) => `${t} mm`).join(', ');
}

/** Warn when a unit has doors and drawers but door vs drawer-front edging thickness differs. */
export function getDoorDrawerEdgingWarnings(job: Job): string[] {
  const warnings: string[] = [];

  for (const unit of job.units) {
    const doorThicknesses = new Set<number>();
    for (const door of unit.doors) {
      if (door.qty <= 0) continue;
      const t = edgingThickness(job, door.edgingMaterialId);
      if (t != null) doorThicknesses.add(t);
    }

    const drawerThicknesses = new Set<number>();
    for (const drawer of activeDrawers(unit.drawers)) {
      const t = edgingThickness(job, drawer.frontEdgingMaterialId);
      if (t != null) drawerThicknesses.add(t);
    }

    if (doorThicknesses.size === 0 || drawerThicknesses.size === 0) continue;

    const doorList = [...doorThicknesses].sort((a, b) => a - b);
    const drawerList = [...drawerThicknesses].sort((a, b) => a - b);
    const matches =
      doorList.length === drawerList.length && doorList.every((value, index) => value === drawerList[index]);

    if (!matches) {
      warnings.push(
        `${unit.name}: door edging thickness (${formatThicknessList(doorList)}) does not match drawer front edging (${formatThicknessList(drawerList)}). Use the same edging thickness on doors and drawer fronts.`,
      );
    }
  }

  return warnings;
}

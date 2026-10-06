import type { InstallEstimate, InstallLine, InstallRates, Job, Unit, UnitType } from '../types';
import { isWallUnit } from './constants';
import { activeDrawerBoxesPerCupboard } from './screwRules';

export const DEFAULT_INSTALL_RATES: InstallRates = {
  enabled: true,
  kitchenBasePerCupboard: 1200,
  wallUnitPerCupboard: 900,
  bedroomPerCupboard: 800,
  perDoorLeaf: 200,
  perDrawer: 350,
  wallMountPremium: 250,
  minimumJob: 3000,
  travelFee: 0,
};

export function resolveInstallRates(job: Job): InstallRates {
  return { ...DEFAULT_INSTALL_RATES, ...job.installRates };
}

function baseRateForType(type: UnitType, rates: InstallRates): number {
  switch (type) {
    case 'kitchen_base':
      return rates.kitchenBasePerCupboard;
    case 'wall':
      return rates.wallUnitPerCupboard;
    case 'bedroom':
      return rates.bedroomPerCupboard;
    default:
      return rates.kitchenBasePerCupboard;
  }
}

function doorLeavesForUnit(unit: Unit, cupboardQty: number): number {
  return unit.doors.reduce((sum, d) => sum + Math.max(0, d.qty), 0) * cupboardQty;
}

function calcUnitInstall(unit: Unit, rates: InstallRates): InstallLine | null {
  const cupboardQty = Math.max(0, unit.unitQty ?? 0);
  if (cupboardQty <= 0) return null;

  const baseRate = baseRateForType(unit.type, rates);
  const baseSubtotal = baseRate * cupboardQty;
  const doorLeaves = doorLeavesForUnit(unit, cupboardQty);
  const doorSubtotal = doorLeaves * rates.perDoorLeaf;
  const drawersPerCupboard = activeDrawerBoxesPerCupboard(unit);
  const drawerCount = drawersPerCupboard * cupboardQty;
  const drawerSubtotal = drawerCount * rates.perDrawer;
  const wallPremium = isWallUnit(unit) ? rates.wallMountPremium * cupboardQty : 0;
  const subtotal = baseSubtotal + doorSubtotal + drawerSubtotal + wallPremium;

  const bits = [
    `${cupboardQty}× @ R${baseRate}`,
    doorLeaves > 0 ? `${doorLeaves} doors @ R${rates.perDoorLeaf}` : null,
    drawerCount > 0 ? `${drawerCount} drawers @ R${rates.perDrawer}` : null,
    wallPremium > 0 ? `wall +R${rates.wallMountPremium}/cupboard` : null,
  ].filter(Boolean);

  return {
    unitName: unit.name,
    unitType: unit.type,
    cupboardQty,
    baseSubtotal,
    doorLeaves,
    doorSubtotal,
    drawerCount,
    drawerSubtotal,
    wallPremium,
    subtotal,
    detail: bits.join(' · '),
  };
}

/** Installation estimate for the whole job (supply separate). */
export function calcJobInstall(job: Job): InstallEstimate | null {
  const rates = resolveInstallRates(job);
  if (!rates.enabled) return null;

  const lines: InstallLine[] = [];
  for (const unit of job.units) {
    const line = calcUnitInstall(unit, rates);
    if (line) lines.push(line);
  }

  if (lines.length === 0) return null;

  const laborSubtotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const minimumApplied = Math.max(0, rates.minimumJob - laborSubtotal);
  const installationTotal = Math.max(laborSubtotal, rates.minimumJob);
  const travelFee = rates.travelFee;

  return {
    lines,
    laborSubtotal,
    minimumJob: rates.minimumJob,
    minimumApplied,
    installationTotal,
    travelFee,
    total: installationTotal + travelFee,
  };
}

export function formatInstallSummary(estimate: InstallEstimate): string {
  const parts = [
    `${estimate.lines.length} unit(s) · labour R ${estimate.installationTotal.toFixed(2)}`,
    estimate.minimumApplied > 0 ? `min job applied` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

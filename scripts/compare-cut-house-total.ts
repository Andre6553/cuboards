/**
 * Compare Cuboards non-hardware costs vs Mossel Bay cut-house quote (QTE125719).
 * Usage: npx tsx scripts/compare-cut-house-total.ts "path/to/job.json"
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { generateCutList } from '../src/lib/calculator';
import { billableEdgingMetres, countFactoryDrillHoles, resolveCutHouseCharges } from '../src/lib/cutHouseCharges';
import { migrateJob } from '../src/lib/storage';
import type { CostLine, Job } from '../types';

const FACTORY_EX = [
  { key: 'white', label: 'White melamine sheets', qty: 2, unitEx: 874.78 },
  { key: 'esperanza', label: 'Esperanza Oak sheets', qty: 1, unitEx: 1259.13 },
  { key: 'smel', label: 'SMEL melamine cut', qty: 3, unitEx: 57.39 },
  { key: 'hb', label: 'HB001 hardboard sheet', qty: 1, unitEx: 222.61 },
  { key: 'shb', label: 'SHB hardboard cut', qty: 1, unitEx: 38.26 },
  { key: 'edg04', label: 'EDG 0.4mm (36 m)', qty: 36, unitEx: 6.96 },
  { key: 'edg2', label: 'EDG 2mm (22 m)', qty: 22, unitEx: 20 },
  { key: 'boor', label: 'BOOR drill', qty: 10, unitEx: 2.61 },
] as const;

function exFromIncl(incl: number, vatPct: number): number {
  return incl / (1 + vatPct / 100);
}

const jsonPath = resolve(process.argv[2] ?? 'scripts/_andre-job.json');
const raw = JSON.parse(readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '')) as Job;
const job = migrateJob(raw);
const result = generateCutList(job);
const vat = job.settings.vatRatePercent ?? 15;
const pricesIncl = job.settings.pricesEnterAsInclVat === true;

const nonHardware = result.costs.filter(
  (c) => c.category !== 'hardware' && c.category !== 'install',
);

function lineEx(c: CostLine): { qty: number; unitEx: number; subEx: number } {
  const unit = pricesIncl ? exFromIncl(c.unitPrice, vat) : c.unitPrice;
  const sub = pricesIncl ? exFromIncl(c.subtotal, vat) : c.subtotal;
  return { qty: c.quantity, unitEx: unit, subEx: sub };
}

console.log('=== JOB ===', job.client.name, 'ref', job.client.ref);
console.log('Prices entered as', pricesIncl ? 'INCL VAT' : 'EX VAT', '| board wastage', job.settings.boardWastagePercent ?? 0, '%');
console.log('Cut house charges:', resolveCutHouseCharges(job));
console.log('Factory drill holes (Cuboards):', countFactoryDrillHoles(job));

const ch = resolveCutHouseCharges(job);
const edgingRaw = new Map<string, number>();
for (const e of result.edging) {
  edgingRaw.set(e.edgingMaterialId, (edgingRaw.get(e.edgingMaterialId) ?? 0) + e.totalLm);
}
console.log('\n=== EDGING raw → billable ===');
for (const em of job.edgingMaterials) {
  const rawLm = edgingRaw.get(em.id);
  if (!rawLm) continue;
  const { billableLm } = billableEdgingMetres(rawLm, ch);
  console.log(`- ${em.name} (${em.thickness}mm): ${rawLm.toFixed(2)} → ${billableLm.toFixed(2)} m (quote qty on cost line uses ceil 0.1)`);
}

console.log('\n=== CUBOARDS (no hardware) ===');
let cubEx = 0;
for (const c of nonHardware) {
  const { qty, unitEx, subEx } = lineEx(c);
  cubEx += subEx;
  console.log(
    `[${c.category}] ${c.name}: qty ${qty} × R${unitEx.toFixed(2)} ex = R${subEx.toFixed(2)} ex | ${c.detail}`,
  );
}
console.log('Subtotal ex VAT (Cuboards, no hardware): R', cubEx.toFixed(2));

const factoryEx = FACTORY_EX.reduce((s, l) => s + l.qty * l.unitEx, 0);
console.log('\n=== FACTORY QTE125719 (ex VAT) ===');
for (const l of FACTORY_EX) {
  console.log(`${l.label}: ${l.qty} × R${l.unitEx.toFixed(2)} = R${(l.qty * l.unitEx).toFixed(2)}`);
}
console.log('Subtotal ex VAT (factory): R', factoryEx.toFixed(2));
console.log('Factory incl VAT @15%: R', (factoryEx * 1.15).toFixed(2));

console.log('\n=== QTY / LINE MATCH (factory target) ===');
const boards = nonHardware.filter((c) => c.category === 'board');
const masonite = nonHardware.find((c) => c.category === 'masonite');
const edging = nonHardware.filter((c) => c.category === 'edging');
const cutHouse = nonHardware.filter((c) => c.category === 'cutHouse');

const white = boards.find((b) => /white/i.test(b.name));
const esp = boards.find((b) => /esperanza/i.test(b.name));
const smel = cutHouse.find((c) => /SMEL/i.test(c.name));
const shb = cutHouse.find((c) => /SHB/i.test(c.name));
const boor = cutHouse.find((c) => /BOOR/i.test(c.name));
const edg04 = edging.find((e) => e.name.includes('0.4'));
const edg2 = edging.find((e) => e.name.includes('2mm'));

function cmp(label: string, got: number | undefined, want: number, tol = 0.01) {
  const ok = got !== undefined && Math.abs(got - want) < tol;
  console.log(`${ok ? '✓' : '✗'} ${label}: Cuboards ${got ?? '—'} vs factory ${want}`);
}

cmp('White sheets', white?.quantity, 2);
cmp('Esperanza sheets', esp?.quantity, 1);
cmp('Masonite sheets', masonite?.quantity, 1);
cmp('SMEL ops', smel?.quantity, 3);
cmp('SHB', shb?.quantity, 1);
cmp('BOOR holes', boor?.quantity, 10);
cmp('Edging 0.4 m', edg04?.quantity, 36);
cmp('Edging 2 mm m', edg2?.quantity, 22);

console.log('\nDelta ex VAT (Cuboards − factory): R', (cubEx - factoryEx).toFixed(2));

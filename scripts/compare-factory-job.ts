/**
 * One-off: compare Cuboards cut list vs external cut-house quote.
 * Usage: npx tsx scripts/compare-factory-job.ts [job-id]
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const val = m[2].trim().replace(/\r$/, '').replace(/^["']|["']$/g, '');
        env[m[1].trim()] = val;
      }
    }
  } catch {
    /* ignore */
  }
  return env;
}

const env = { ...loadEnv(), ...process.env };
import { generateCutList } from '../src/lib/calculator';
import { buildFactoryCutListGroups } from '../src/lib/factoryCutList';
import { filterPiecesForOrderSupplier } from '../src/lib/orderSupplier';
import { migrateJob } from '../src/lib/storage';
import type { Job } from '../src/types';

const jobId = process.argv[2] ?? '1b44bbc1-1d8b-4f4f-bd31-c34e0210beb1';
const supplier = process.argv[3] ?? 'Cut and Edge Mosselbaai';
const localPath = resolve(process.cwd(), 'scripts/_andre-job.json');

let rawJob: Job;
if (process.argv.includes('--local') || existsSync(localPath)) {
  rawJob = JSON.parse(readFileSync(localPath, 'utf8').replace(/^\uFEFF/, '')) as Job;
} else {
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env in .env (or use scripts/_andre-job.json)');
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase.from('cuboards_jobs').select('data').eq('id', jobId).maybeSingle();
  if (error || !data?.data) {
    console.error('Could not load job', error?.message ?? 'not found');
    process.exit(1);
  }
  rawJob = data.data as Job;
}

const j = migrateJob(rawJob);
const result = generateCutList(j);
const pieces = filterPiecesForOrderSupplier(j, result.pieces, supplier);
const groups = buildFactoryCutListGroups(j, pieces);

console.log('=== JOB ===');
console.log('Client:', j.client.name, '| Ref:', j.client.ref);
console.log(
  'Units:',
  j.units.length,
  '| Total cupboards (unitQty):',
  j.units.reduce((s, u) => s + (u.unitQty ?? 1), 0),
);
console.log('Sheet size (settings):', j.settings.sheetWidth, '×', j.settings.sheetHeight, 'mm');
console.log('Board wastage %:', j.settings.boardWastagePercent ?? 0);

console.log('\n=== CUBOARDS SHEET ESTIMATES (quote engine) ===');
for (const c of result.costs.filter((x) => x.category === 'board' || x.category === 'masonite')) {
  console.log(
    `- ${c.name}: ${c.quantity} sheet(s) @ R${c.unitPrice} → R${c.subtotal.toFixed(2)}`,
  );
  console.log(`    ${c.detail}`);
}

console.log('\n=== CUBOARDS EDGING (quote engine) ===');
for (const c of result.costs.filter((x) => x.category === 'edging')) {
  console.log(`- ${c.name}: ${c.quantity} lm @ R${c.unitPrice}/m → R${c.subtotal.toFixed(2)}`);
}

console.log(`\n=== FACTORY CUT LIST (${supplier}) ===`);
console.log('Cut pieces (lines):', pieces.length, '| Total part qty:', pieces.reduce((s, p) => s + p.qty, 0));
for (const g of groups) {
  console.log('\n' + g.heading);
  for (const r of g.rows) {
    console.log(
      `  ${r.description} | ${r.lengthMm}×${r.widthMm} ×${r.qty} | ${r.edgingColour || 'no edge'} ${r.edgingThickMm ?? ''}mm`,
    );
  }
}

const edgingLm = new Map<string, number>();
for (const e of result.edging) {
  const em = j.edgingMaterials.find((x) => x.id === e.edgingMaterialId);
  const label = em ? `${em.name} (${em.thickness}mm)` : e.edgingMaterialId;
  edgingLm.set(label, (edgingLm.get(label) ?? 0) + e.totalLm);
}
console.log('\n=== EDGING METRES (raw from cut list) ===');
for (const [label, lm] of edgingLm) {
  console.log(`- ${label}: ${lm.toFixed(2)} m`);
}

console.log('\nCuboards grand total (your quote settings): R', result.grandTotal.toFixed(2));

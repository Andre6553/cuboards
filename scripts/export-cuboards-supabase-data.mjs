/**
 * Export all Cuboards Supabase public tables + auth users to one JSON file.
 *
 * Requires in .env (repo root) or environment:
 *   VITE_SUPABASE_URL=https://vnsmgvdmxlrfffehzjpf.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Usage: node scripts/export-cuboards-supabase-data.mjs [outputPath]
 * Default output: data/cuboards-supabase-data-export.json
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadDotEnv() {
  try {
    const raw = readFileSync(join(root, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* no .env */
  }
}

loadDotEnv();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outPath =
  process.argv[2] || join(root, 'data', 'cuboards-supabase-data-export.json');

const PUBLIC_TABLES = [
  'profiles',
  'device_installs',
  'user_devices',
  'subscription_payments',
  'cuboards_jobs',
  'cuboards_user_prefs',
];

const PROJECT_REF = 'vnsmgvdmxlrfffehzjpf';

if (!url || !serviceKey) {
  console.error(
    'Missing VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. Add them to .env and retry.',
  );
  process.exit(1);
}

if (!url.includes(PROJECT_REF)) {
  console.error(
    `Refusing export: URL must be Cuboards project ${PROJECT_REF}, got ${url}`,
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAllAuthUsers() {
  const users = [];
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }
  return users;
}

async function fetchTable(table) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

const exportedAt = new Date().toISOString();
const payload = {
  meta: {
    projectRef: PROJECT_REF,
    projectUrl: url.replace(/\/$/, ''),
    exportedAt,
    note: 'Contains user PII and job data — do not commit or share publicly.',
  },
  auth_users: [],
  public: {},
};

console.log('Fetching auth.users…');
payload.auth_users = await fetchAllAuthUsers();

for (const table of PUBLIC_TABLES) {
  console.log(`Fetching public.${table}…`);
  payload.public[table] = await fetchTable(table);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`Wrote ${outPath}`);
console.log(
  `Rows: auth_users=${payload.auth_users.length}, ` +
    PUBLIC_TABLES.map((t) => `${t}=${payload.public[t].length}`).join(', '),
);

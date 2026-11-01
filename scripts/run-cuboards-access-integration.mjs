#!/usr/bin/env node
/**
 * Supabase integration tests: RLS + cloud-sync RPC access (isolated project only).
 *
 * Required env (use a non-production project / Supabase branch after migrations):
 *   CUBOARDS_INTEGRATION_SUPABASE_URL
 *   CUBOARDS_INTEGRATION_ANON_KEY
 *   CUBOARDS_INTEGRATION_SERVICE_ROLE_KEY
 *
 * Optional:
 *   CUBOARDS_ALLOW_PROD_INTEGRATION=1  — only if you intentionally run against prod (not recommended)
 *
 * Apply migrations in order (see docs/security-migration-order.md):
 *   0010 → 0011 → 0012 → 0013
 *
 * Does NOT run against production Cuboards (vnsmgvdmxlrfffehzjpf) unless override is set.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const PROD_PROJECT_REF = 'vnsmgvdmxlrfffehzjpf';

function trimEnv(name) {
  const v = process.env[name]?.trim();
  return v || null;
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function skip(msg) {
  console.log(`SKIP: ${msg}`);
  process.exit(0);
}

function assert(condition, msg) {
  if (!condition) fail(msg);
}

async function ensureAccessFunction(admin) {
  const { data, error } = await admin.rpc('cuboards_user_has_access');
  if (error?.code === 'PGRST202' || error?.message?.includes('Could not find')) {
    fail('cuboards_user_has_access() missing — apply migration 0012 on this database first');
  }
  if (error) fail(`cuboards_user_has_access probe: ${error.message}`);
  return data;
}

async function createTestUser(admin, label) {
  const email = `cuboards-access-${label}-${randomUUID().slice(0, 8)}@integration.test`;
  const password = `Test-${randomUUID().slice(0, 12)}!aA1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) fail(`createUser ${label}: ${error.message}`);
  return { id: data.user.id, email, password };
}

async function setProfile(admin, userId, patch) {
  const { error } = await admin.from('profiles').upsert({
    id: userId,
    email: patch.email ?? `${userId}@integration.test`,
    ...patch,
  });
  if (error) fail(`profile ${userId}: ${error.message}`);
}

function userClient(url, anonKey) {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) fail(`signIn ${email}: ${error.message}`);
  return data.session;
}

async function testJobInsert(client, userId, jobId, expectOk) {
  const row = {
    user_id: userId,
    id: jobId,
    data: { client: { name: 'integration' } },
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from('cuboards_jobs').insert(row);
  if (expectOk) {
    assert(!error, `expected insert ok for ${userId}, got ${error?.message ?? error}`);
  } else {
    assert(Boolean(error), `expected insert denied for ${userId}`);
  }
}

async function testJobSelectOther(client, otherUserId, jobId, expectRows) {
  const { data, error } = await client
    .from('cuboards_jobs')
    .select('id')
    .eq('user_id', otherUserId)
    .eq('id', jobId);
  if (error && !expectRows) return;
  if (error) fail(`select other: ${error.message}`);
  const count = data?.length ?? 0;
  if (expectRows) assert(count === 1, `expected 1 row, got ${count}`);
  else assert(count === 0, `expected 0 rows (cross-account), got ${count}`);
}

async function testRpcUpsert(client, jobId, expectOk) {
  const { data, error } = await client.rpc('cuboards_upsert_job_if_not_stale', {
    p_job_id: jobId,
    p_data: { client: { name: 'rpc' } },
    p_updated_at: new Date().toISOString(),
  });
  if (expectOk) {
    assert(!error && (data === 'ok' || data === 'conflict'), `RPC upsert: ${error?.message ?? data}`);
  } else {
    assert(Boolean(error), 'expected RPC upsert denied');
  }
}

async function cleanup(admin, userIds) {
  for (const id of userIds) {
    await admin.from('cuboards_jobs').delete().eq('user_id', id);
    await admin.from('cuboards_user_prefs').delete().eq('user_id', id);
    await admin.from('profiles').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);
  }
}

async function main() {
  const url = trimEnv('CUBOARDS_INTEGRATION_SUPABASE_URL');
  const anonKey = trimEnv('CUBOARDS_INTEGRATION_ANON_KEY');
  const serviceKey = trimEnv('CUBOARDS_INTEGRATION_SERVICE_ROLE_KEY');

  if (!url || !anonKey || !serviceKey) {
    skip(
      'Set CUBOARDS_INTEGRATION_SUPABASE_URL, CUBOARDS_INTEGRATION_ANON_KEY, and CUBOARDS_INTEGRATION_SERVICE_ROLE_KEY on an isolated Supabase project (migrations 0010–0013 applied).',
    );
  }

  if (url.includes(PROD_PROJECT_REF) && trimEnv('CUBOARDS_ALLOW_PROD_INTEGRATION') !== '1') {
    fail(
      `Refusing production project ref ${PROD_PROJECT_REF}. Use a branch/preview project or set CUBOARDS_ALLOW_PROD_INTEGRATION=1 (not recommended).`,
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await ensureAccessFunction(admin);

  const jobActive = randomUUID();
  const jobTrial = randomUUID();
  const jobExpired = randomUUID();
  const jobCross = randomUUID();
  const userIds = [];

  try {
    const active = await createTestUser(admin, 'active');
    userIds.push(active.id);
    await setProfile(admin, active.id, {
      email: active.email,
      access_status: 'active',
      paid_until: '2099-12-31T00:00:00Z',
    });

    const trial = await createTestUser(admin, 'trial');
    userIds.push(trial.id);
    await setProfile(admin, trial.id, {
      email: trial.email,
      access_status: 'trial',
      trial_use_days_remaining: 10,
    });

    const expired = await createTestUser(admin, 'expired');
    userIds.push(expired.id);
    await setProfile(admin, expired.id, {
      email: expired.email,
      access_status: 'trial',
      trial_use_days_remaining: 0,
    });

    const pending = await createTestUser(admin, 'pending');
    userIds.push(pending.id);
    await setProfile(admin, pending.id, {
      email: pending.email,
      access_status: 'pending',
    });

    await admin.from('cuboards_jobs').insert({
      user_id: active.id,
      id: jobCross,
      data: { client: { name: 'victim' } },
      updated_at: new Date().toISOString(),
    });

    const activeClient = userClient(url, anonKey);
    await signIn(activeClient, active.email, active.password);
    await testJobInsert(activeClient, active.id, jobActive, true);
    await testJobSelectOther(activeClient, trial.id, jobCross, false);
    await testRpcUpsert(activeClient, jobActive, true);

    const trialClient = userClient(url, anonKey);
    await signIn(trialClient, trial.email, trial.password);
    await testJobInsert(trialClient, trial.id, jobTrial, true);

    const expiredClient = userClient(url, anonKey);
    await signIn(expiredClient, expired.email, expired.password);
    await testJobInsert(expiredClient, expired.id, jobExpired, false);
    await testRpcUpsert(expiredClient, jobExpired, false);

    const pendingClient = userClient(url, anonKey);
    await signIn(pendingClient, pending.email, pending.password);
    await testJobInsert(pendingClient, pending.id, randomUUID(), false);

    const anonClient = userClient(url, anonKey);
    const { error: anonErr } = await anonClient.from('cuboards_jobs').select('id').limit(1);
    assert(Boolean(anonErr), 'expected anon select on cuboards_jobs to fail');

    console.log('PASS: cuboards access integration matrix');
    console.log('  active: insert + RPC ok');
    console.log('  trial: insert ok');
    console.log('  expired/pending: insert + RPC denied');
    console.log('  cross-account: no rows for other user_id');
    console.log('  anon: denied');
  } finally {
    await cleanup(admin, userIds);
    await admin.from('cuboards_jobs').delete().eq('id', jobCross);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

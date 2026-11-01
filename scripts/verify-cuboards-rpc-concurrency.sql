-- Local PostgreSQL concurrency check for 0010 RPC (run via scripts/run-cuboards-rpc-verify.sh).
\set test_user 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
\set test_job 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$ SELECT :'test_user'::uuid $$;

CREATE TABLE IF NOT EXISTS public.cuboards_jobs (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

\i supabase/migrations/0010_cuboards_job_atomic_sync.sql

DELETE FROM public.cuboards_jobs;

-- 1) Simultaneous create: two writers same new id
SELECT public.cuboards_upsert_job_if_not_stale(
  :'test_job'::uuid,
  '{"client":{"name":"A"}}'::jsonb,
  '2026-11-01T12:00:00+00'::timestamptz
) AS first_create;

SELECT public.cuboards_upsert_job_if_not_stale(
  :'test_job'::uuid,
  '{"client":{"name":"B"}}'::jsonb,
  '2026-11-01T12:00:00+00'::timestamptz
) AS second_create_same_ts_diff_body;

-- 2) Equal timestamp, identical body (idempotent)
SELECT public.cuboards_upsert_job_if_not_stale(
  :'test_job'::uuid,
  (SELECT data FROM public.cuboards_jobs WHERE id = :'test_job'::uuid),
  '2026-11-01T12:00:00+00'::timestamptz
) AS idempotent_retry;

-- 3) Equal timestamp, different body must conflict
SELECT public.cuboards_upsert_job_if_not_stale(
  :'test_job'::uuid,
  '{"client":{"name":"C"}}'::jsonb,
  '2026-11-01T12:00:00+00'::timestamptz
) AS equal_ts_diff_body;

-- 4) Strictly newer remote blocks stale writer
SELECT public.cuboards_upsert_job_if_not_stale(
  :'test_job'::uuid,
  '{"client":{"name":"D"}}'::jsonb,
  '2026-11-01T11:00:00+00'::timestamptz
) AS stale_writer;

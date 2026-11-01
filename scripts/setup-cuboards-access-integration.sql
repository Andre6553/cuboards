-- Run on an ISOLATED Supabase project (not production Cuboards) before npm run test:access-integration.
-- Apply repo migrations in order via Supabase CLI or SQL editor:
--   0010_cuboards_job_atomic_sync.sql
--   0011_lock_confirm_payment_rpc.sql
--   0012_enforce_cloud_access_rls.sql
--   0013_atomic_rpc_access_gate.sql
--
-- Quick sanity checks:

select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in (
    'cuboards_job_sync_lock',
    'cuboards_upsert_job_if_not_stale',
    'cuboards_delete_job_if_not_stale',
    'cuboards_user_has_access'
  )
order by proname;

select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('cuboards_jobs', 'cuboards_user_prefs')
  and qual like '%cuboards_user_has_access%'
order by tablename, policyname;

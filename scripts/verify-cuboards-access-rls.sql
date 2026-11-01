-- Manual verification after 0012 (+ 0013 for RPC gate) on approved environment only.
-- Replace :user_a and :user_b with two test auth user uuids when exercising cross-account checks.

-- 1) Function exists
select proname, prosecdef
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname = 'cuboards_user_has_access';

-- 2) Policies reference access gate
select tablename, policyname, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('cuboards_jobs', 'cuboards_user_prefs')
order by tablename, policyname;

-- 3) confirm RPC still service_role only
select r.rolname, has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.rolname in ('anon', 'authenticated', 'service_role')
where n.nspname = 'public'
  and p.proname = 'confirm_cuboards_subscription_payment'
  and has_function_privilege(r.oid, p.oid, 'EXECUTE');

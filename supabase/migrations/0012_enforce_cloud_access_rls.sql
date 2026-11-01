-- Server-side paid/trial gate for cloud jobs and user prefs (RLS only).
-- Prerequisite: none beyond existing cuboards_jobs / cuboards_user_prefs tables.
-- Next: apply 0010 (atomic sync RPCs) before 0013 (RPC access gate).

create or replace function public.cuboards_user_has_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        (p.access_status = 'active' and (p.paid_until is null or p.paid_until >= now()))
        or (
          p.access_status = 'trial'
          and coalesce(p.trial_use_days_remaining, 0) > 0
        )
      from public.profiles as p
      where p.id = auth.uid()
    ),
    false
  );
$$;

comment on function public.cuboards_user_has_access() is
  'True when the current user may read/write cuboards_jobs and cuboards_user_prefs (matches get_my_access has_access rules without side effects).';

revoke all on function public.cuboards_user_has_access() from public;
grant execute on function public.cuboards_user_has_access() to authenticated;

-- cuboards_jobs
drop policy if exists "cuboards_jobs_select_own" on public.cuboards_jobs;
drop policy if exists "cuboards_jobs_insert_own" on public.cuboards_jobs;
drop policy if exists "cuboards_jobs_update_own" on public.cuboards_jobs;
drop policy if exists "cuboards_jobs_delete_own" on public.cuboards_jobs;

create policy "cuboards_jobs_select_own"
  on public.cuboards_jobs for select to authenticated
  using (auth.uid() = user_id and public.cuboards_user_has_access());

create policy "cuboards_jobs_insert_own"
  on public.cuboards_jobs for insert to authenticated
  with check (auth.uid() = user_id and public.cuboards_user_has_access());

create policy "cuboards_jobs_update_own"
  on public.cuboards_jobs for update to authenticated
  using (auth.uid() = user_id and public.cuboards_user_has_access())
  with check (auth.uid() = user_id and public.cuboards_user_has_access());

create policy "cuboards_jobs_delete_own"
  on public.cuboards_jobs for delete to authenticated
  using (auth.uid() = user_id and public.cuboards_user_has_access());

-- cuboards_user_prefs
drop policy if exists "cuboards_user_prefs_select_own" on public.cuboards_user_prefs;
drop policy if exists "cuboards_user_prefs_insert_own" on public.cuboards_user_prefs;
drop policy if exists "cuboards_user_prefs_update_own" on public.cuboards_user_prefs;

create policy "cuboards_user_prefs_select_own"
  on public.cuboards_user_prefs for select to authenticated
  using (auth.uid() = user_id and public.cuboards_user_has_access());

create policy "cuboards_user_prefs_insert_own"
  on public.cuboards_user_prefs for insert to authenticated
  with check (auth.uid() = user_id and public.cuboards_user_has_access());

create policy "cuboards_user_prefs_update_own"
  on public.cuboards_user_prefs for update to authenticated
  using (auth.uid() = user_id and public.cuboards_user_has_access())
  with check (auth.uid() = user_id and public.cuboards_user_has_access());

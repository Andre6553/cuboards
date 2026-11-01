-- Server-side paid/trial gate for cloud jobs, prefs, and atomic sync RPCs.
-- Read-only check (does not consume trial use days — that stays in get_my_access / record_device_login).

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

-- Atomic job RPCs (requires 0010 applied first)
create or replace function public.cuboards_upsert_job_if_not_stale(
  p_job_id uuid,
  p_data jsonb,
  p_updated_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_remote timestamptz;
  v_remote_data jsonb;
  v_written timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.cuboards_user_has_access() then
    raise exception 'subscription required' using errcode = '42501';
  end if;

  perform public.cuboards_job_sync_lock(p_job_id);

  select j.updated_at, j.data
  into v_remote, v_remote_data
  from public.cuboards_jobs as j
  where j.user_id = v_uid and j.id = p_job_id
  for update;

  if v_remote is not null and v_remote > p_updated_at then
    return 'conflict';
  end if;

  if v_remote is not null and v_remote = p_updated_at and v_remote_data is distinct from p_data then
    return 'conflict';
  end if;

  if v_remote is not null and v_remote = p_updated_at and v_remote_data is not distinct from p_data then
    return 'ok';
  end if;

  insert into public.cuboards_jobs as j (user_id, id, data, updated_at)
  values (v_uid, p_job_id, p_data, p_updated_at)
  on conflict (user_id, id) do update
    set data = excluded.data,
        updated_at = excluded.updated_at
    where j.updated_at < excluded.updated_at
       or (j.updated_at = excluded.updated_at and j.data is not distinct from excluded.data)
  returning j.updated_at into v_written;

  if v_written is not null then
    return 'ok';
  end if;

  select j.updated_at, j.data
  into v_remote, v_remote_data
  from public.cuboards_jobs as j
  where j.user_id = v_uid and j.id = p_job_id;

  if v_remote is null then
    return 'conflict';
  end if;

  if v_remote > p_updated_at then
    return 'conflict';
  end if;

  if v_remote = p_updated_at and v_remote_data is distinct from p_data then
    return 'conflict';
  end if;

  return 'ok';
end;
$$;

create or replace function public.cuboards_delete_job_if_not_stale(
  p_job_id uuid,
  p_updated_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_remote timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not public.cuboards_user_has_access() then
    raise exception 'subscription required' using errcode = '42501';
  end if;

  perform public.cuboards_job_sync_lock(p_job_id);

  select j.updated_at
  into v_remote
  from public.cuboards_jobs as j
  where j.user_id = v_uid and j.id = p_job_id
  for update;

  if v_remote is null then
    return 'ok';
  end if;

  if v_remote > p_updated_at then
    return 'conflict';
  end if;

  delete from public.cuboards_jobs
  where user_id = v_uid and id = p_job_id;

  return 'ok';
end;
$$;

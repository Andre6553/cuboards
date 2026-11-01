-- Access gate inside atomic job sync RPCs (requires 0010 + 0012 applied first).

do $$
begin
  if to_regprocedure('public.cuboards_job_sync_lock(uuid)') is null then
    raise exception
      'Missing public.cuboards_job_sync_lock(uuid). Apply supabase/migrations/0010_cuboards_job_atomic_sync.sql before 0013.';
  end if;
  if to_regprocedure('public.cuboards_user_has_access()') is null then
    raise exception
      'Missing public.cuboards_user_has_access(). Apply supabase/migrations/0012_enforce_cloud_access_rls.sql before 0013.';
  end if;
end $$;

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

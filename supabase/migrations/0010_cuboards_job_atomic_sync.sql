-- Atomic job upsert/delete guarded by updated_at (apply on Cuboards Supabase when approved).

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
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select j.updated_at
  into v_remote
  from public.cuboards_jobs as j
  where j.user_id = v_uid and j.id = p_job_id
  for update;

  if v_remote is not null and v_remote > p_updated_at then
    return 'conflict';
  end if;

  insert into public.cuboards_jobs as j (user_id, id, data, updated_at)
  values (v_uid, p_job_id, p_data, p_updated_at)
  on conflict (user_id, id) do update
    set data = excluded.data,
        updated_at = excluded.updated_at;

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

grant execute on function public.cuboards_upsert_job_if_not_stale(uuid, jsonb, timestamptz) to authenticated;
grant execute on function public.cuboards_delete_job_if_not_stale(uuid, timestamptz) to authenticated;

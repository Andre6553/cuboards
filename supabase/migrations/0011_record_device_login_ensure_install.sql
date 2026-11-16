-- record_device_login used to insert user_devices without ensuring device_installs,
-- which raised FK 23503 → PostgREST HTTP 409 on every session refresh.

create or replace function public.record_device_login(p_install_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_install_id is null then
    return;
  end if;

  insert into public.device_installs (install_id, trial_consumed, first_user_id)
  values (p_install_id, false, uid)
  on conflict (install_id) do nothing;

  insert into public.user_devices (user_id, install_id, last_seen_at)
  values (uid, p_install_id, now())
  on conflict (user_id, install_id)
  do update set last_seen_at = now();
end;
$$;

grant execute on function public.record_device_login(uuid) to authenticated;

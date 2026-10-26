-- Cuboards: 30-day trial on email confirmation (no per-device trial limit)

-- ---------------------------------------------------------------------------
-- Grant trial when auth.users.email_confirmed_at becomes set
-- ---------------------------------------------------------------------------

create or replace function public.grant_trial_on_email_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  confirmed_at timestamptz;
begin
  if tg_op = 'UPDATE' then
    if old.email_confirmed_at is not null or new.email_confirmed_at is null then
      return new;
    end if;
    confirmed_at := new.email_confirmed_at;
  elsif tg_op = 'INSERT' then
    if new.email_confirmed_at is null then
      return new;
    end if;
    confirmed_at := new.email_confirmed_at;
  else
    return new;
  end if;

  insert into public.profiles (id, email, access_status)
  values (new.id, coalesce(new.email, ''), 'pending')
  on conflict (id) do nothing;

  update public.profiles
  set
    access_status = case
      when confirmed_at + interval '30 days' < now() then 'expired'
      else 'trial'
    end,
    trial_ends_at = coalesce(trial_ends_at, confirmed_at + interval '30 days'),
    email = coalesce(new.email, email),
    updated_at = now()
  where id = new.id
    and access_status = 'pending';

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed_cuboards on auth.users;
create trigger on_auth_user_email_confirmed_cuboards
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.grant_trial_on_email_confirm();

drop trigger if exists on_auth_user_insert_email_confirmed_cuboards on auth.users;
create trigger on_auth_user_insert_email_confirmed_cuboards
  after insert on auth.users
  for each row
  when (new.email_confirmed_at is not null)
  execute function public.grant_trial_on_email_confirm();

-- Backfill: confirmed users still on pending
insert into public.profiles (id, email, access_status)
select u.id, coalesce(u.email, ''), 'pending'
from auth.users u
where u.email_confirmed_at is not null
  and not exists (select 1 from public.profiles p where p.id = u.id);

update public.profiles p
set
  access_status = case
    when u.email_confirmed_at + interval '30 days' < now() then 'expired'
    else 'trial'
  end,
  trial_ends_at = coalesce(p.trial_ends_at, u.email_confirmed_at + interval '30 days'),
  updated_at = now()
from auth.users u
where p.id = u.id
  and u.email_confirmed_at is not null
  and p.access_status = 'pending';

-- ---------------------------------------------------------------------------
-- finalize_cuboards_signup: device tracking only; trial from email confirm
-- 0001 left a uuid overload that still granted a per-device trial. Drop it.
-- ---------------------------------------------------------------------------

drop function if exists public.finalize_cuboards_signup(uuid);

create or replace function public.finalize_cuboards_signup(p_install_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_confirmed_at timestamptz;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_install_id is null or p_install_id = '' then
    raise exception 'Install id required';
  end if;

  insert into public.device_installs (install_id, trial_consumed, first_user_id)
  values (p_install_id, false, uid)
  on conflict (install_id) do nothing;

  update public.device_installs
  set first_user_id = coalesce(first_user_id, uid)
  where install_id = p_install_id;

  insert into public.user_devices (user_id, install_id, last_seen_at)
  values (uid, p_install_id, now())
  on conflict (user_id, install_id)
  do update set last_seen_at = now();

  select email_confirmed_at into v_confirmed_at
  from auth.users
  where id = uid;

  if v_confirmed_at is not null then
    update public.profiles
    set
      access_status = case
        when v_confirmed_at + interval '30 days' < now() then 'expired'
        else 'trial'
      end,
      trial_ends_at = coalesce(trial_ends_at, v_confirmed_at + interval '30 days'),
      updated_at = now()
    where id = uid
      and access_status = 'pending';
  end if;

  return public.get_my_access();
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: users must not self-elevate access (no client profile updates)
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_update_own" on public.profiles;

-- No UPDATE policy on profiles: subscription fields change only via security definer RPCs/triggers.

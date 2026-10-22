-- Cuboards: profiles, 90-day trial, device install anti-abuse

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  access_status text not null default 'pending'
    check (access_status in ('pending', 'trial', 'active', 'expired')),
  trial_ends_at timestamptz,
  paid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per Cuboards user; access_status gates the app.';

-- Browser-persistent install id (localStorage); one trial per install_id ever
create table public.device_installs (
  install_id uuid primary key,
  trial_consumed boolean not null default false,
  first_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.user_devices (
  user_id uuid not null references auth.users (id) on delete cascade,
  install_id uuid not null references public.device_installs (install_id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, install_id)
);

create index user_devices_install_id_idx on public.user_devices (install_id);

alter table public.profiles enable row level security;
alter table public.device_installs enable row level security;
alter table public.user_devices enable row level security;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No direct client access to device tables (RPC only)

create or replace function public.handle_new_cuboards_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, access_status)
  values (new.id, coalesce(new.email, ''), 'pending');
  return new;
end;
$$;

create trigger on_auth_user_created_cuboards
  after insert on auth.users
  for each row execute function public.handle_new_cuboards_user();

create or replace function public.get_my_access()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  has_access boolean;
begin
  if uid is null then
    return jsonb_build_object('authenticated', false);
  end if;

  select * into p from public.profiles where id = uid;
  if not found then
    return jsonb_build_object(
      'authenticated', true,
      'access_status', 'pending',
      'has_access', false,
      'email', (select email from auth.users where id = uid)
    );
  end if;

  if p.access_status = 'trial' and p.trial_ends_at is not null and p.trial_ends_at < now() then
    update public.profiles set access_status = 'expired', updated_at = now() where id = uid;
    p.access_status := 'expired';
  end if;

  if p.access_status = 'active' and p.paid_until is not null and p.paid_until < now() then
    update public.profiles set access_status = 'expired', updated_at = now() where id = uid;
    p.access_status := 'expired';
  end if;

  has_access := p.access_status in ('trial', 'active');

  return jsonb_build_object(
    'authenticated', true,
    'access_status', p.access_status,
    'trial_ends_at', p.trial_ends_at,
    'paid_until', p.paid_until,
    'has_access', has_access,
    'email', p.email
  );
end;
$$;

create or replace function public.finalize_cuboards_signup(p_install_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_trial_consumed boolean;
  v_trial_end timestamptz;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_install_id is null then
    raise exception 'Install id required';
  end if;

  insert into public.device_installs (install_id, trial_consumed, first_user_id)
  values (p_install_id, false, uid)
  on conflict (install_id) do nothing;

  select trial_consumed into v_trial_consumed
  from public.device_installs
  where install_id = p_install_id;

  if v_trial_consumed then
    update public.profiles
    set access_status = 'expired',
        trial_ends_at = now(),
        updated_at = now()
    where id = uid;
  else
    v_trial_end := now() + interval '90 days';
    update public.profiles
    set access_status = 'trial',
        trial_ends_at = v_trial_end,
        updated_at = now()
    where id = uid;

    update public.device_installs
    set trial_consumed = true,
        first_user_id = coalesce(first_user_id, uid)
    where install_id = p_install_id;
  end if;

  insert into public.user_devices (user_id, install_id, last_seen_at)
  values (uid, p_install_id, now())
  on conflict (user_id, install_id)
  do update set last_seen_at = now();

  return public.get_my_access();
end;
$$;

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

  insert into public.user_devices (user_id, install_id, last_seen_at)
  values (uid, p_install_id, now())
  on conflict (user_id, install_id)
  do update set last_seen_at = now();
end;
$$;

grant execute on function public.get_my_access() to authenticated;
grant execute on function public.finalize_cuboards_signup(uuid) to authenticated;
grant execute on function public.record_device_login(uuid) to authenticated;

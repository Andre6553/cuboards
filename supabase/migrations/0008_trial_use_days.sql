-- Trial = 30 days of use (one calendar day in Africa/Johannesburg per open), not 30 calendar days.
-- Paid subscription = 360 days from payment (calendar).

alter table public.profiles
  add column if not exists trial_use_days_remaining int,
  add column if not exists trial_last_use_date date;

comment on column public.profiles.trial_use_days_remaining is
  'Days left in use-based trial; decremented once per calendar day (Africa/Johannesburg) the user opens the app.';
comment on column public.profiles.trial_last_use_date is
  'Last calendar day (Africa/Johannesburg) that counted against the use-based trial.';
comment on column public.profiles.created_at is 'Account registration time (profile row created).';

create or replace function public.cuboards_sast_date()
returns date
language sql
stable
as $$
  select (timezone('Africa/Johannesburg', now()))::date;
$$;

create or replace function public.consume_trial_use_day(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
  v_today date := public.cuboards_sast_date();
  v_remaining int;
begin
  select * into p from public.profiles where id = p_user_id for update;
  if not found or p.access_status <> 'trial' then
    return;
  end if;

  v_remaining := coalesce(p.trial_use_days_remaining, 0);
  if v_remaining <= 0 then
    update public.profiles
    set access_status = 'expired', updated_at = now()
    where id = p_user_id and access_status = 'trial';
    return;
  end if;

  if p.trial_last_use_date is not distinct from v_today then
    return;
  end if;

  v_remaining := v_remaining - 1;
  update public.profiles
  set
    trial_last_use_date = v_today,
    trial_use_days_remaining = v_remaining,
    access_status = case when v_remaining <= 0 then 'expired' else 'trial' end,
    updated_at = now()
  where id = p_user_id;
end;
$$;

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

  perform public.consume_trial_use_day(uid);

  select * into p from public.profiles where id = uid;
  if not found then
    return jsonb_build_object(
      'authenticated', true,
      'access_status', 'pending',
      'has_access', false,
      'coupon_code', null,
      'trial_use_days_remaining', null,
      'registered_at', null,
      'email', (select email from auth.users where id = uid)
    );
  end if;

  if p.access_status = 'trial' and coalesce(p.trial_use_days_remaining, 0) <= 0 then
    update public.profiles set access_status = 'expired', updated_at = now() where id = uid;
    p.access_status := 'expired';
  end if;

  if p.access_status = 'active' and p.paid_until is not null and p.paid_until < now() then
    update public.profiles set access_status = 'expired', updated_at = now() where id = uid;
    p.access_status := 'expired';
  end if;

  has_access := p.access_status = 'active'
    or (p.access_status = 'trial' and coalesce(p.trial_use_days_remaining, 0) > 0);

  return jsonb_build_object(
    'authenticated', true,
    'access_status', p.access_status,
    'trial_ends_at', p.trial_ends_at,
    'trial_use_days_remaining', p.trial_use_days_remaining,
    'paid_until', p.paid_until,
    'has_access', has_access,
    'coupon_code', p.coupon_code,
    'registered_at', p.created_at,
    'email', p.email
  );
end;
$$;

create or replace function public.grant_trial_on_email_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.email_confirmed_at is not null or new.email_confirmed_at is null then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    if new.email_confirmed_at is null then
      return new;
    end if;
  else
    return new;
  end if;

  insert into public.profiles (id, email, access_status)
  values (new.id, coalesce(new.email, ''), 'pending')
  on conflict (id) do nothing;

  update public.profiles
  set
    access_status = 'trial',
    trial_use_days_remaining = 30,
    trial_last_use_date = null,
    trial_ends_at = null,
    email = coalesce(new.email, email),
    updated_at = now()
  where id = new.id
    and access_status = 'pending';

  return new;
end;
$$;

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
  values (p_install_id::uuid, false, uid)
  on conflict (install_id) do nothing;

  update public.device_installs
  set first_user_id = coalesce(first_user_id, uid)
  where install_id = p_install_id::uuid;

  insert into public.user_devices (user_id, install_id, last_seen_at)
  values (uid, p_install_id::uuid, now())
  on conflict (user_id, install_id)
  do update set last_seen_at = now();

  select email_confirmed_at into v_confirmed_at
  from auth.users
  where id = uid;

  if v_confirmed_at is not null then
    update public.profiles
    set
      access_status = 'trial',
      trial_use_days_remaining = coalesce(trial_use_days_remaining, 30),
      trial_last_use_date = trial_last_use_date,
      trial_ends_at = null,
      updated_at = now()
    where id = uid
      and access_status = 'pending';
  end if;

  return public.get_my_access();
end;
$$;

create or replace function public.redeem_cuboards_coupon(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_days int;
  v_updated int;
  v_new_remaining int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  v_days := case v_code
    when 'CUB30' then 30
    when 'CUB60' then 60
    when 'CUB90' then 90
    else null
  end;

  if v_days is null then
    raise exception 'That coupon code is not valid';
  end if;

  select * into p from public.profiles where id = uid for update;
  if not found then
    raise exception 'Account is not ready yet';
  end if;

  if p.coupon_redeemed_at is not null then
    raise exception 'A coupon has already been used on this account';
  end if;

  if p.access_status = 'active' and p.paid_until is not null and p.paid_until > now() then
    update public.profiles
    set
      paid_until = p.paid_until + make_interval(days => v_days),
      coupon_code = v_code,
      coupon_redeemed_at = now(),
      updated_at = now()
    where id = uid
      and coupon_redeemed_at is null;
  else
    v_new_remaining := coalesce(p.trial_use_days_remaining, 0) + v_days;
    if v_new_remaining <= 0 then
      raise exception 'Could not apply coupon';
    end if;
    update public.profiles
    set
      access_status = 'trial',
      trial_use_days_remaining = v_new_remaining,
      trial_ends_at = null,
      coupon_code = v_code,
      coupon_redeemed_at = now(),
      updated_at = now()
    where id = uid
      and coupon_redeemed_at is null;
  end if;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'A coupon has already been used on this account';
  end if;

  return public.get_my_access();
end;
$$;

create or replace function public.confirm_cuboards_subscription_payment(
  p_payment_id uuid,
  p_pf_payment_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.subscription_payments;
  v_term interval := interval '360 days';
begin
  select * into pay from public.subscription_payments where id = p_payment_id for update;
  if not found then
    return false;
  end if;
  if pay.status = 'complete' then
    return true;
  end if;

  update public.subscription_payments
  set status = 'complete',
      pf_payment_id = coalesce(p_pf_payment_id, pf_payment_id),
      completed_at = now()
  where id = p_payment_id;

  update public.profiles
  set access_status = 'active',
      paid_until = case
        when paid_until is not null and paid_until > now() then paid_until + v_term
        else now() + v_term
      end,
      trial_use_days_remaining = null,
      trial_last_use_date = null,
      updated_at = now()
  where id = pay.user_id;

  return true;
end;
$$;

-- Existing trial users: switch to use-based pool (30 days left; today will consume one on next login).
update public.profiles
set
  trial_use_days_remaining = 30,
  trial_last_use_date = null,
  trial_ends_at = null,
  updated_at = now()
where access_status = 'trial';

update public.profiles
set
  trial_use_days_remaining = null,
  trial_last_use_date = null,
  updated_at = now()
where access_status = 'active';

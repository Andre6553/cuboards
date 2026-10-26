-- One coupon per account. Days are added on top of access already left
-- (later of now, trial_ends_at, and paid_until). A second code is rejected.

alter table public.profiles
  add column if not exists coupon_code text,
  add column if not exists coupon_redeemed_at timestamptz;

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
      'coupon_code', null,
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
    'coupon_code', p.coupon_code,
    'email', p.email
  );
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
  v_base timestamptz;
  v_end timestamptz;
  v_updated int;
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

  v_base := greatest(
    now(),
    coalesce(p.trial_ends_at, now()),
    coalesce(p.paid_until, now())
  );
  v_end := v_base + make_interval(days => v_days);

  if p.access_status = 'active' and p.paid_until is not null and p.paid_until > now() then
    update public.profiles
    set
      paid_until = v_end,
      coupon_code = v_code,
      coupon_redeemed_at = now(),
      updated_at = now()
    where id = uid
      and coupon_redeemed_at is null;
  else
    update public.profiles
    set
      access_status = 'trial',
      trial_ends_at = v_end,
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

revoke all on function public.redeem_cuboards_coupon(text) from public;
revoke all on function public.redeem_cuboards_coupon(text) from anon;
grant execute on function public.redeem_cuboards_coupon(text) to authenticated;

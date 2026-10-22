-- Cuboards: 30-day trial, annual subscription (PayFast amount set in env — default R500/year)

create or replace function public.finalize_cuboards_signup(p_install_id text)
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
    v_trial_end := now() + interval '30 days';
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
  v_year interval := interval '1 year';
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
        when paid_until is not null and paid_until > now() then paid_until + v_year
        else now() + v_year
      end,
      updated_at = now()
  where id = pay.user_id;

  return true;
end;
$$;

-- Cuboards: PayFast monthly subscription payments

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending'
    check (status in ('pending', 'complete', 'failed', 'cancelled')),
  pf_payment_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index subscription_payments_user_id_idx on public.subscription_payments (user_id);
create index subscription_payments_status_idx on public.subscription_payments (status);

alter table public.subscription_payments enable row level security;

create policy "subscription_payments_select_own"
  on public.subscription_payments for select to authenticated
  using (auth.uid() = user_id);

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
  v_month interval := interval '1 month';
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
        when paid_until is not null and paid_until > now() then paid_until + v_month
        else now() + v_month
      end,
      updated_at = now()
  where id = pay.user_id;

  return true;
end;
$$;

grant execute on function public.confirm_cuboards_subscription_payment(uuid, text) to service_role;

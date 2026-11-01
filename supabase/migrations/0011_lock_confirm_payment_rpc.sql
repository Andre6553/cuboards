-- Lock subscription confirmation to service_role (PayFast ITN via Vercel only).
-- Idempotent: safe if already applied manually on production.

revoke execute on function public.confirm_cuboards_subscription_payment(uuid, text)
  from public, anon, authenticated;

grant execute on function public.confirm_cuboards_subscription_payment(uuid, text)
  to service_role;

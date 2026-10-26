# Cuboards — Supabase Auth & trial setup

## Dashboard (one-time)

1. **Authentication → Providers** — Email enabled.
2. **Authentication → URL configuration** — add your app URL(s), e.g. `http://localhost:5199` and your **production Vercel URL** (required for email confirmation links).
3. For quick testing, you can **disable “Confirm email”** under Email provider (otherwise users must confirm before first sign-in).
4. **Project Settings → API** — copy URL + anon key into `.env` as `VITE_SUPABASE_*` and set the same on **Vercel**.

## Behaviour

- Sign up / sign in with **email + password** (Supabase Auth).
- After the user **confirms their email**, the database grants **30 days of use** (one calendar day in South Africa per day they open the app; `profiles.trial_use_days_remaining`, `trial_last_use_date`, registration in `profiles.created_at`).
- Until those use days are used up, there is **no payment page**; PayFast appears when access is **expired** (no trial days left or subscription lapsed). Coupon entry shows on the paywall only if they have not redeemed a coupon yet.
- **PayFast subscription** extends **`paid_until`** by **360 calendar days** from payment (or stacks on an existing active period).
- **Jobs and client data** sync to `cuboards_jobs` (full job JSON per row). **RLS:** each row’s `user_id` must match `auth.uid()` — installers never see each other’s data. Per account in `cuboards_user_prefs` (same RLS): board catalog, **My default prices**, **unit presets**, and **Gelmar price snapshot** (live refreshed SKU prices — not the full Gelmar catalog JSON). Browser storage keys are scoped by user id so signing in as someone else on the same PC does not mix jobs.

## SQL

Migrations live in `supabase/migrations/`.

**Production database** (`vnsmgvdmxlrfffehzjpf`): apply new migrations manually in the Supabase **SQL Editor** (paste the full contents of the migration file). The app repo does not auto-deploy SQL to Supabase from CI.

Apply migrations in order through **`0008_trial_use_days.sql`** (use-based trial + 360-day subscription term).

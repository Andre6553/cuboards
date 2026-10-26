# Cuboards — Supabase Auth & trial setup

## Dashboard (one-time)

1. **Authentication → Providers** — Email enabled.
2. **Authentication → URL configuration** — add your app URL(s), e.g. `http://localhost:5199` and your **production Vercel URL** (required for email confirmation links).
3. For quick testing, you can **disable “Confirm email”** under Email provider (otherwise users must confirm before first sign-in).
4. **Project Settings → API** — copy URL + anon key into `.env` as `VITE_SUPABASE_*` and set the same on **Vercel**.

## Behaviour

- Sign up / sign in with **email + password** (Supabase Auth).
- After the user **confirms their email**, the database grants a **30-day trial** with full app access (every confirmed account gets one trial; no per-browser limit).
- Until the trial ends, there is **no payment page**; PayFast appears only when access is **expired** (trial over or subscription lapsed).
- **Jobs and client data** sync to `cuboards_jobs` (full job JSON per row). **RLS:** each row’s `user_id` must match `auth.uid()` — installers never see each other’s data. Per account in `cuboards_user_prefs` (same RLS): board catalog, **My default prices**, **unit presets**, and **Gelmar price snapshot** (live refreshed SKU prices — not the full Gelmar catalog JSON). Browser storage keys are scoped by user id so signing in as someone else on the same PC does not mix jobs.

## SQL

Migrations live in `supabase/migrations/`.

**Production database** (`vnsmgvdmxlrfffehzjpf`): apply new migrations manually in the Supabase **SQL Editor** (paste the full contents of the migration file). The app repo does not auto-deploy SQL to Supabase from CI.

Minimum for trial-on-confirm behaviour: run `0006_trial_on_email_confirm.sql` after earlier migrations are already applied.

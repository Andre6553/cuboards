# Cuboards — Supabase Auth & trial setup

## Dashboard (one-time)

1. **Authentication → Providers** — Email enabled.
2. **Authentication → URL configuration** — add your app URL(s), e.g. `http://localhost:5199` and production Vercel URL.
3. For quick testing, you can **disable “Confirm email”** under Email provider (otherwise users must confirm before first sign-in).
4. **Project Settings → API** — copy URL + anon key into `.env` as `VITE_SUPABASE_*` and set the same on **Vercel**.

## Behaviour

- Sign up / sign in with **email + password** (Supabase Auth).
- **30-day trial** with full app access, granted once per **browser install id** (`localStorage` key `cuboards_install_id`).
- A second account on the **same browser profile** does **not** get another trial (RPC `finalize_cuboards_signup`).
- Clearing site data or another browser/device can still start a new install id — stronger fingerprinting is a later upgrade.
- **Jobs and client data** sync to `cuboards_jobs` (full job JSON per row). **RLS:** each row’s `user_id` must match `auth.uid()` — installers never see each other’s data. Per account in `cuboards_user_prefs` (same RLS): board catalog, **My default prices**, **unit presets**, and **Gelmar price snapshot** (live refreshed SKU prices — not the full Gelmar catalog JSON). Browser storage keys are scoped by user id so signing in as someone else on the same PC does not mix jobs.

## SQL

Migrations live in `supabase/migrations/`. Applied to project **`vnsmgvdmxlrfffehzjpf`** only.

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

## SQL

Migrations live in `supabase/migrations/`. Applied to project **`vnsmgvdmxlrfffehzjpf`** only.

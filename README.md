# Cuboards

Cuboards helps kitchen and bedroom cupboard installers turn a client job into a cut list, material and hardware estimate, factory order, and client quote.

## What it does

- Build client jobs with carcasses, doors, drawers, shelves, fillers, kickplates, back panels, and unit presets.
- Choose board and edging materials, grain direction, suppliers, sheet sizes, saw kerf, and hardware. Calculate sheet requirements, edging lengths, hardware quantities, and costs.
- View sheet layouts and offcuts. Export factory cut lists, full costing sheets, and client quotes as PDFs; filter factory orders by supplier.
- Keep a board catalog, default prices, and Gelmar hardware prices. Refresh supported Gelmar prices from the app.
- Sign in with Supabase to sync jobs and preferences between devices. Pending job changes are kept in a browser queue and retried when the connection returns. Jobs can also be exported and imported as JSON backups.
- Use the installable web app offline for work already available on the device. Cloud sync, sign-in, payments, and live price refresh require a connection.
- Offer a 30-day use trial, coupons, and annual access through PayFast. Payment is configured separately on the server.

## Run locally

Install Node.js, then from this folder:

```bash
npm install
npm run dev
```

Open `http://localhost:5199`. On Windows, `Start Cuboards.bat` is another way to start the app. The Vite server provides the Gelmar price routes locally. PayFast server functions need a Vercel environment for end-to-end checkout testing.

For a production build, run `npm run build`; the output is in `dist/`. Other commands are `npm run lint`, `npm test`, and `npm run preview`.

## Supabase and deployment

Copy `.env.example` to `.env` and fill in the Cuboards Supabase project URL and public key. Keep `SUPABASE_SERVICE_ROLE_KEY` and PayFast credentials on the server only; never put them in a `VITE_` variable or commit `.env`.

Supabase migrations are in `supabase/migrations/` and must be applied to the **Cuboards** project in order. They are not deployed by the Vercel build. Migration `0010_cuboards_job_atomic_sync.sql` supplies atomic conflict checks for concurrent job changes; the client has a fallback when these functions are unavailable. See [Supabase setup](docs/supabase-auth-setup.md) for authentication and trial setup.

Vercel serves the app and the `api/` functions for Gelmar prices and PayFast. Configure the Supabase server key, PayFast settings, and public `APP_URL` there. See [PayFast setup](docs/payfast-setup.md) and [Vercel troubleshooting](docs/vercel-deploy-troubleshooting.md). PayFast notifications need a public HTTPS URL.

## Where data lives

Signed-in jobs and preferences are stored in Supabase, with browser storage used for local work and caching. Job changes waiting for upload are stored in IndexedDB. Export a JSON backup from the dashboard before clearing browser data or moving devices. Accounts have separate browser storage scopes.

## Code map

- `src/components/` — dashboard, job editor, forms, cut-list views, and subscription screens.
- `src/lib/calculator.ts`, `sheetLayout.ts`, `sheetCost.ts` — cut-list and sheet calculations.
- `src/lib/pdf.ts`, `quotePdf.ts`, `sheetMapPdf.ts` — PDF outputs.
- `src/lib/storage.ts` — local job creation, migration, import, and storage.
- `src/lib/jobCloudSync.ts`, `cloudJobOperations.ts`, `cloudJobQueue.ts` — cloud merge, conflict checks, and queued uploads.
- `api/` — Vercel functions for Gelmar price refresh and PayFast checkout/notifications.
- `supabase/migrations/` — database schema and access rules.

For current project decisions and history, see [PROJECT.md](PROJECT.md).

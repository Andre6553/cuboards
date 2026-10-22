# Cuboards — PayFast subscription

Monthly **Cuboards Pro** after the 90-day trial. Uses the same signing rules as BizTap
(outgoing redirect skips empty fields; **ITN** verifies from the raw posted body).

## Vercel environment variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Same as client (API admin client) |
| `SUPABASE_SERVICE_ROLE_KEY` | ITN + initiate (server only) |
| `PAYFAST_SANDBOX` | `true` (default) for sandbox |
| `PAYFAST_MERCHANT_ID` / `KEY` / `PASSPHRASE` | Your live merchant; leave blank in sandbox to use PayFast test merchant `10000100` |
| `PAYFAST_SUBSCRIPTION_CENTS` | Default `19900` (R199) |
| `APP_URL` | e.g. `https://your-app.vercel.app` — return & notify URLs |
| `VITE_SUBSCRIPTION_PRICE_LABEL` | Shown in UI, e.g. `R199/month` |

## Flow

1. Expired user → **Pay with PayFast** → `POST /api/payfast-initiate` (Bearer session JWT).
2. Browser POSTs signed form to PayFast sandbox/live.
3. PayFast **ITN** → `POST /api/payfast-notify` → `confirm_cuboards_subscription_payment` → `profiles.access_status = active`, `paid_until` + 1 month.
4. User returns to `/?subscription=success` and taps **I've paid — refresh access** if needed.

## Local testing

PayFast ITN needs a **public URL**. Use a Vercel preview deploy or `vercel dev` — plain
`npm run dev` does not run `api/payfast-*` unless you proxy separately.

**Sandbox is not “localhost mode”.** Test checkout on **https://cuboards.vercel.app** (or a
preview URL). On Vercel, set `APP_URL=https://cuboards.vercel.app` — do **not** copy
`APP_URL=http://localhost:…` from local `.env` (PayFast returns **400** if return/notify URLs
are localhost).

Sandbox test cards: [PayFast testing docs](https://developers.payfast.co.za/docs#testing).

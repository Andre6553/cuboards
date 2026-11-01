# Cuboards security migrations — apply order

**Production Cuboards Supabase:** `vnsmgvdmxlrfffehzjpf` — apply only after explicit approval.

| Order | File | Purpose |
|------:|------|---------|
| 1 | `0010_cuboards_job_atomic_sync.sql` | `cuboards_job_sync_lock`, upsert/delete RPCs |
| 2 | `0011_lock_confirm_payment_rpc.sql` | PayFast confirm RPC → `service_role` only |
| 3 | `0012_enforce_cloud_access_rls.sql` | `cuboards_user_has_access()` + RLS on jobs/prefs |
| 4 | `0013_atomic_rpc_access_gate.sql` | RPC access checks (**fails** if `0010` or `0012` missing) |

`0012` does **not** depend on `0010`. `0013` depends on **both** `0010` and `0012`.

Integration tests: `npm run test:access-integration` (isolated project only — see script header).

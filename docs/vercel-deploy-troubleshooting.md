# Vercel not deploying from GitHub

## Symptom

- `main` on GitHub has new commits (e.g. auth + PayFast).
- [cuboards.vercel.app](https://cuboards.vercel.app) still serves an old JS bundle (no Sign in / no Supabase in the built assets).
- GitHub **Deployments** last entry is an old SHA (e.g. `fd5f399`), not current `main`.

## Immediate fix (dashboard)

1. [Vercel → cuboards → Deployments](https://vercel.com/andres-projects-a5191921/cuboards/deployments)
2. **Create Deployment** → Git branch **`main`** → latest commit → **Production**.

## Fix Git auto-deploy

1. **GitHub App access**  
   [github.com/settings/installations](https://github.com/settings/installations) → **Vercel** → **Configure** → ensure **Andre6553/cuboards** is allowed (or “All repositories”).

2. **Vercel Git settings**  
   Project → **Settings → Git** → connected repo **Andre6553/cuboards**, production branch **`main`**.  
   If pushes still do nothing: **Disconnect** → connect again and re-authorize GitHub.

3. **Ignored Build Step**  
   Settings → Git → if “Ignored Build Step” is set, it may skip builds. Clear it or use a command that exits `1` only when you truly want to skip.

## Reliable bypass: GitHub Actions

Workflow: `.github/workflows/vercel-production.yml` runs on every push to `main`.

Add **Repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|--------|
| `VERCEL_TOKEN` | Create at [vercel.com/account/settings/tokens](https://vercel.com/account/settings/tokens) (full account scope). |
| `VERCEL_ORG_ID` | `team_e2sK25kM7y4fnex23iJ2yhLu` |
| `VERCEL_PROJECT_ID` | `prj_fptdosiygQaYfteIs2UULrSRX9aN` |

Push to `main` or run **Actions → Deploy production (Vercel) → Run workflow**.

## Verify production

After deploy **Ready**, open the site and view source: the main script should be a **new** `index-*.js` hash. Search that file for `supabase` — it should be present when auth is in the build.

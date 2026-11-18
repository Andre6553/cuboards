# Project: Cuboards

> Tier 2 of the Information Hierarchy. Read `../_ABOUT-ME/` first.

## What it is
Professional **cut-list software for kitchen & bedroom cupboard installers**. Calculates
carcasses, doors, drawers, edging, hardware, cost estimates, and exports a PDF cut-list.
Strong candidate to sell as a tool/subscription to installers.

## Stack & key paths
- **GitHub:** https://github.com/Andre6553/cuboards (public)
- **Supabase (Cuboards only):** ref `vnsmgvdmxlrfffehzjpf`, region `eu-west-1` — credentials in
  `.env`; migrations in `supabase/migrations/`. MCP: `supabase-cuboards` in `~/.cursor/mcp.json`.
  SQL policy: `.cursor/rules/supabase-sql.mdc`. **Not** the BizTap DB (`vsujfqufdyoxfaopqcut`).
- **Vite + TypeScript** web app. Source in `src/`, built site in `dist/`.
- `Start Cuboards.bat` launches it; dev: `npm install` then `npm run dev`
  (http://localhost:5173). See `README.md`.
- Docs in `docs/`.

## Status
Active (v1 feature set built: client jobs, calculators, edging, hardware, PDF export).
**Supabase auth live 2026-10-22** — email/password login, **30-day trial** (full access), one trial per
browser install id (anti re-signup abuse). **Jobs + default prices sync to Supabase** when signed in
(`cuboards_jobs`, `cuboards_user_prefs`, migration `0004_jobs_cloud_sync.sql`); localStorage is a cache.
**Save as my default prices** applies settings to all jobs (boards add-only) and uploads prefs + jobs so PC/mobile stay in sync.
Setup: `docs/supabase-auth-setup.md`. Migration `0001_auth_profiles_trial_device.sql`.
**PayFast Pro (2026-10-22):** `api/payfast-initiate.js`, `api/payfast-notify.js`, migration
`0002_payfast_subscriptions.sql` + `0003_trial_30d_annual_subscription.sql` — **R500/year** after trial, sandbox-ready. See `docs/payfast-setup.md`.

**2026-10-22:** Pricing → **30-day trial**, **R500/year** (PayFast one-off annual; `paid_until` +1 year on ITN). Existing accounts keep their current `trial_ends_at` / `paid_until`.

## Notes
- **2026-11-17:** **My default prices** (`priceList.ts`, `PriceListBar.tsx`) — **Save** upserts the board catalog (never deletes types), enriches a thin job with missing boards from catalog/other jobs, applies settings/prices to **all jobs** (client + units unchanged), then uploads `cuboards_user_prefs` + jobs to Supabase. **New job** (signed in) fetches account `price_list` first. **Load** still applies defaults to this job only.
- **2026-11-17:** **Masonite dual sheets** (`masoniteSheetRules.ts`) — small 2440×1220 + large 2750×1830 @ R475; quote auto-picks large when total area > small sheet or a panel/cupboard will not fit on the small long side. Each size has its own colour, thickness, buy-as, cut house, size, and price. Costing / sheet maps / offcuts / SHB use the chosen sheet.
- **2026-11-17:** **Customize door sizes** (Doors header tick): manual door height; width from L/R gaps; opening = height + T/B gaps. Drawers warn if a door exists and custom doors is off; with custom on, drawers use remaining height after door openings.
- **2026-11-17:** **Customize drawer / front sizes** (unit tick): manual **front height** (+ box height); opening height is display-only (front + gaps); front width from L/R gaps; grain top→bottom; warn if drawers+doors > carcass H; warn + warning chime if front height < box height (`warningChime.ts`).
- **2026-11-17:** Drawer clearances default **front 0 / back 25** mm. **Top filler** material is always selectable.
- **2026-11-17:** Kitchen base mount **Tall Floor unit** (`tall_floor`): same carcass as wall (Bottom + Top + 2 fillers, no countertop) plus **Kitchen plinth — kickplate & feet**.
- **2026-11-18:** Carcass preview photos in `public/graphics/`: no/with shelf, spice, wall, tall, **floor corner**, **wall corner** (`corner_floor.jpg`, `corner_wall.jpg`). Preview also shows for corner mounts.
- **2026-11-17:** Wall mount: no **Extra bottom (wall)** — one Bottom + Top on pure wall units, plus **2 top fillers** (front/back).
- **2026-11-17:** **Floor corner** (kitchen base) + **Wall corner** (wall unit). Floor: 884² panels, H×550 sides, fillers 2×748×100, masonite 2×H×900, doors 341/325. Wall: 584² panels (bottom+2 shelves+top), H×300 sides, filler1 2×(H−2T)×typed width (default 70), filler2 2×514×70, filler3 2×498×70, masonite 2×H×600, doors 291/275. T/B gaps only on doors (`floorCornerRules.ts`, `wallCornerRules.ts`).
- **2026-11-17:** Sheet-map lightbox zoom: always position via `translate(pan)` (center pan at fit). Old CSS flex-center + top-left pan math made the sheet jump left when zooming in.
- **2026-11-17:** Guillotine nest (`sheetLayout.ts`): when a rotatable part ties on shelf/sheet rank, prefer **lower cross-grain height** so a non-grain tall panel (e.g. 780×1810 Esperanza back) does not lock a full-height rip strip and open an extra sheet for a thin filler.
- **2026-11-16:** Carcass **shelves** with **solid melamine backing**: depth **D−T**, width **W−2T** (was full D with masonite/none). `carcassShelfSize` in `carcassRules.ts`.
- **2026-11-16:** Drawer box side depth = carcass depth − back clearance − 2×board T (not front clearance). Solid melamine bottom depth = same as drawer side; width = front/back inner (FB width − 2×T). Masonite bottom still uses inner −2×T both ways (`drawerBoxRules.ts`).
- **2026-11-16:** `record_device_login` 409 was FK on `user_devices` when `device_installs` had no row for this browser. RPC now upserts the install first (`0011_record_device_login_ensure_install.sql`). Client also coalesces duplicate login RPCs on page load.
- **2026-11-16:** **Extras** (after Drawers): **Bedroom** = inner boxes (`ExtraInnerForm`, `extrasRules.ts`). **Kitchen base / wall** = custom doors, panels, fillers — qty, length×width, board, edging pattern + tape (`customExtras`, `ExtraCustomPartsForm.tsx`, `customExtrasRules.ts`). `extrasEnabled` gates both.
- **2026-11-16:** Bedroom cupboards show **Kitchen plinth — kickplate & feet**. The same kickplate and feet math is included on the cut list.
- **2026-11-16:** Bedroom cupboard on **wall mount** uses the wall carcass. Optional **side fillers** (2 × filler width × carcass height) and **top fillers** (2 × filler width × carcass width). Tick boxes and filler width are on the carcass form.
- **2026-11-16:** Wall-mounted **kitchen base** units get the same top fillers as a floor unit (2 for stone, 3 for a wooden top). Pure wall units use a Top panel instead. Bedroom wall units do not.
- **2026-11-16:** Door **hinge holes** dropdown (shown when Factory drill is on). Default **2** if finished door height ≤ 1200 mm, **4** if taller. That count is the hinge qty on the quote and the factory Holes column / BOOR hole count. Options 2–6 (`hingeHoleCount` on the door).
- **2026-11-09:** **Spice cupboard** mount — standard carcass (no shelf), normal top fillers. Cut list: front/back (runner bay width × user height, default 600 max carcass H, 2L+1S), split, L/R shelves, bottom, 2× 100×bottom-width fillers (`spiceCupboardRules.ts`).
- **2026-10-27:** **Full cut list cost estimate** — **Wood material** (boards, edging, masonite, SMEL/SHB/BOOR) vs **Hardware** subtotals, then install + grand total; same grouping on full PDF. Masonite sheet count uses **layout/area calc** by default (optional checkbox to match cut-house 1× HB PDF).
- **2026-10-27:** **Cut-house quote lines** (Prices → Sheet settings): SMEL / SHB / BOOR + edging order % — separate from **Gelmar hardware** on the quote. Incl-VAT integer line math + R1 incl snap for whole-rand ex (optional 1× HB masonite).
- **2026-10-27:** **Order from** cut house per board (+ masonite, job default) — Factory tab filter + PDF per supplier (`factory-cutlist-{ref}-{supplier}-{date}.pdf`); sheet maps filtered to match.
- **2026-10-27:** Per-board **supplier prices** (Gelmar, Promas, etc.) in shared catalog JSON — optional list + pick which drives quote / sheet; no Supabase migration (stored in existing `board_catalog`).
- **2026-10-26:** **Community board catalog** — opt-in (`accept_community_materials` in prefs + checkbox under Board materials). New board types (name+colour) publish to `cuboards_community_materials` on cloud sync; other users get a login/refresh prompt to add with their own price/grain/buy-as/edging. Migration `0009_community_board_materials.sql` on `vnsmgvdmxlrfffehzjpf`.
- **2026-10-26:** Trial is **30 days of use** (SAST calendar day per app open), not 30 calendar days — migration `0008_trial_use_days.sql` on Supabase. PayFast subscription = **360 days** from payment on `paid_until`.
- **2026-10-26:** Permanent members (manual DB): `andre.ecprint@gmail.com`, `riaanvdw186@gmail.com` — `access_status = active`, `paid_until = 2099-12-31`.
- **2026-10-26:** One coupon per account (`0007_coupon_codes.sql`, applied on `vnsmgvdmxlrfffehzjpf`). Cub30 / Cub60 / Cub90 add 30 / 60 / 90 days on top of the later of now, trial end, or paid-until. A second code is rejected. Box is on the dashboard and the paywall.
- **2026-10-26:** Applied `0006_trial_on_email_confirm` on Cuboards Supabase (`vnsmgvdmxlrfffehzjpf`). Trial starts when email is confirmed. Dropped leftover `finalize_cuboards_signup(uuid)` from migration 0001 — it still granted a 90-day per-device trial and could override the new text function.
- _Add pricing/packaging plan and installer feedback here._
- **2026-10-22:** Wood kickplate edging aligned with cut list: **Long** = tape on kick **run** (factory B ticks), **short** = on **height** (factory L ticks); cut list/factory/edging metres all use same counts (not generic door `1_long` labels).
- **2026-10-06:** Cut-list calc fixes (backup `Backup/calc_20261006_123807/`): 1-long edging uses the front/top run not max(W,H); drawer box front/back width = internal − 2×runner clearance (sides inside; drop-in bottom inner −2T); side depth = D − front − back clearance; drop-in bottoms (no groove); wooden top is one full panel not fillers+top; Blum length rounds down to 50 mm; hinges 5 above 2 m; screw fronts use qty×frontQty. For a drawer tower add one row per height — qty 4 on one row is four matching boxes.
- **2026-10-21:** Drawer box front/back no longer subtract 2×T for box sides — width = carcass internal − 2×runner clearance (e.g. 500 mm unit → **442 mm** @ 16 mm T, 13 mm clearance). Drop-in bottom inner width uses that minus 2×T.
- **2026-10-21:** Carcass **Side (left/right)** always **1 long** on front edge; removed “side visible” toggles (old `leftVisible`/`rightVisible` in JSON ignored).
- **2026-10-21:** Cut list merges rows with the same board, **Length × Height**, grain, and edging — qty summed; part names joined (e.g. Side left/right, drawer front/back).
- **2026-10-21:** **Drawer front** height = `(carcass H − top gap − bottom gap − (total fronts − 1)×4 mm) ÷ total stacked fronts`. **Box height** = user **Box height (mm)** field only (removed Front over box / auto box from front).
- **2026-10-21 (deferred):** Mixed drawer front heights (e.g. 3× fixed + 1× fill remainder) — today all stacked fronts equal-split; Andre to spec/build later (fixed mm per row + auto remainder row).
- **2026-10-21:** Cut list panel sizes round to **nearest whole mm** (factory / panel saw — no 140.8-style decimals).
- **2026-10-21:** Factory + full PDF — board/masonite **group headings** (material — edging) **bold 12 pt** (was 9 pt normal).
- **2026-10-21:** Cut list shows **long-edged side first** (e.g. drawer side **500 × 130** when `longAlong` is width); doors/sides still height × depth when long on length.
- **2026-10-21:** **No back panel** units can add **Visible back panel** — user width/height (default carcass W×H), material/grain follow door or drawer front; **edging pattern + tape** choosable (defaults from door/drawer).
- **2026-10-22:** **Factory + full PDF** include **visual sheet maps** (same nest diagrams as on-screen; `sheetMapDiagram.ts` + `sheetMapPdf.ts`) after the cut tables.
- **2026-10-22:** **Global board + edging catalog** (`materialCatalog.ts`, localStorage `cuboards_board_catalog`) — shared by all jobs; edits in Prices & settings sync to every job on the device.
- **2026-10-22:** **Corner blocks** (`cornerBlockRules.ts`): from visible sides (checkboxes or material inference), shelf qty, floor top fillers (2 granite / 3 wooden), **+4** for melamine backing inside carcass; 0 visible sides → none except backing. **4×16 mm**: 4 per corner block + floor **12×16** when one exposed side. Floor drawer fronts **4×3.5×28 mm** (1049/4359 pack rule). **2026-10-21:** Floor carcass/drawer **41 mm** (4372/4361). Wall units keep legacy screw rates.
- **2026-10-21:** **Board costing** — all materials + masonite: sheet count = **max(area × wastage %, nesting + kerf)**; **Buy as** adds **⅓ sheet** option (factory cut house).
- **2026-10-21:** **Factory** deliverable is **PDF only** (no Excel) — Mosselbaai-style table grouped by **board + edging tape** (same keys as Full board groups); Unit ID, L1–B2, Thick, edging colour, **Holes** on doors; per-door **Factory: drill hinge holes**.
- **2026-10-06:** Cut list has **Factory** and **Full** (quote sheet). PDF filenames: `factory-cutlist-…` / `full-cutlist-…`.
- **2026-10-06 (UX pass):** Job editor tabs are now **Units** (client + units, opens first) · **Prices & settings** · **Cut list**. **My default prices** bar (`src/lib/priceList.ts`, localStorage `cuboards_price_list`): "Save these as my default prices" seeds every new job; "Load default prices into this job" merges prices only (boards/edging by id, settings + units untouched). Remove unit now confirms. Dashboard: "saved on this device only" notice + **Back up all jobs** (Import accepts single job or full backup array), search, quote total per card, **Duplicate**. Phone fix at 320 px: cost rows stack, carcass size label wraps.
- **2026-10-06 (grouping):** Cut list has one **Board cut list** (no separate "Doors & drawers" section). One table per **board material + edging tape (name + thickness)**, e.g. "White 16mm — PVC White (1 mm)" and "White 16mm — PVC White (2 mm)" are separate tables. Carcass, door and drawer parts sit together; the Edging column shows only the pattern. "No edging" tables come last for each board. Masonite stays separate. `groupBoardCutList` in `calculator.ts`; result field `boardGroups`.
- **2026-10-06 (grain):** On boards with **Grain** ticked, sides, doors and drawer fronts are grain-locked: the grain runs along the first size (Length = part height, top to bottom). Cut list and PDF show a **Grain** column ("Top to bottom", including wood kickplates on grain boards). Sheet count for grain boards comes from guillotine (panel-saw strip) layout in `src/lib/sheetLayout.ts` (sheet grain = long side, e.g. 2750; locked parts never rotated, other parts may rotate; configurable saw kerf in Job settings, default 4 mm). The last sheet is rounded up to ¼ sheet, and the result is never below the old area estimate. Parts taller than the sheet's grain length get a warning. Boards without grain still use the plain area estimate.
- **2026-10-06:** Materials Gelmar **Refresh** buttons (runners, hinges, screws, connecting fittings) call `/api/gelmar-*` and write live prices into the current job. Local: Vite middleware (`npm run dev` / `preview`, port 5199). **Vercel:** `api/gelmar-*.js` + `vercel.json` (no env vars). Blum/Hettich/generic runner presets stay hardcoded.
- **2026-10-08:** Vercel serverless Gelmar APIs added for production Refresh; SPA rewrite excludes `/api/*`.
- **2026-10-09:** Mobile unit form: responsive `auto-fit` grids + drawer box hints moved out of grid so material/edging selects are full width on phone.
- **2026-10-09:** Cut list tab **Client quote** + portrait PDF (`quotePdf.ts`) — scope, supply/install totals, exclusions; no panel sizes (Factory/Full unchanged).
- **2026-10-09:** SA quote polish (2–8): VAT breakdown, board wastage %, backup reminder, mobile edging table, sheet presets, runner price note, editable quote terms; dashboard quote incl VAT when enabled.
- **2026-10-09:** **Board offcuts** on **full** cut list + full PDF only (not factory PDF) — from sheet nesting; board wastage % is quote sheet count only, not offcut geometry.
- **2026-10-09:** **NumberInput** — mobile-friendly numeric fields (clear/retype without snapping to 0); replaces `type="number"` on units/prices forms.
- **2026-10-09:** **Quote currency** — Job settings dropdown (ZAR default + regional/common codes); `formatMoney` drives cut list, dashboard, full PDF, client quote PDF. No FX conversion — you enter amounts in that currency.
- **2026-10-09:** **Hardware pricing mode** — per category (runners, hinges, screws, connecting fittings): checkbox *Use Gelmar catalog & live refresh* (default on). Off → custom product table (description + price; pack qty for screws/fittings). Stored on job + **My default prices** (`hardwarePricing` in `priceList.ts`). Unit dropdowns use custom catalog via `hardwarePricing.ts`.
- **2026-10-13:** **SA valuation snapshot** — `docs/valuation-2026.md` (~R20k–R40k as-is asset; revenue unlocks higher); synced to `Bussiness idea/02-Cuboards-SaaS/`.
- **2026-10-09:** **Premium roadmap** captured in `docs/premium-roadmap.md` (sync, branded PDF, CRM, PayFast, sheet maps, etc.).
- **2026-10-09:** **Visual sheet maps** — Factory + Full cut list tabs show SVG nest per material/sheet (`sheetLayout.ts` placements, `SheetMapView.tsx`); same engine as offcuts. PWA + brand bar from earlier same day.

# Project: Cuboards

> Tier 2 of the Information Hierarchy. Read `../_ABOUT-ME/` first.

## What it is
Professional **cut-list software for kitchen & bedroom cupboard installers**. Calculates
carcasses, doors, drawers, edging, hardware, cost estimates, and exports a PDF cut-list.
Strong candidate to sell as a tool/subscription to installers.

## Stack & key paths
- **GitHub:** https://github.com/Andre6553/cuboards (public)
- **Vite + TypeScript** web app. Source in `src/`, built site in `dist/`.
- `Start Cuboards.bat` launches it; dev: `npm install` then `npm run dev`
  (http://localhost:5173). See `README.md`.
- Docs in `docs/`.

## Status
Active (v1 feature set built: client jobs, calculators, edging, hardware, PDF export).

## Notes
- _Add pricing/packaging plan and installer feedback here._
- **2026-10-06:** Cut-list calc fixes (backup `Backup/calc_20261006_123807/`): 1-long edging uses the front/top run not max(W,H); drawer box front/back sits between sides (−2T); side depth = D − front − back clearance; drop-in bottoms (no groove); wooden top is one full panel not fillers+top; Blum length rounds down to 50 mm; hinges 5 above 2 m; screw fronts use qty×frontQty. For a drawer tower add one row per height — qty 4 on one row is four matching boxes.
- **2026-10-06:** Cut list has **Factory** (panel sizes + edging types only; no metres, kickplate, prices, hinges, screws, or installation) and **Full** (quote sheet). PDF: `factory-cutlist-…` / `full-cutlist-…`.
- **2026-10-06 (UX pass):** Job editor tabs are now **Units** (client + units, opens first) · **Prices & settings** · **Cut list**. **My default prices** bar (`src/lib/priceList.ts`, localStorage `cuboards_price_list`): "Save these as my default prices" seeds every new job; "Load default prices into this job" merges prices only (boards/edging by id, settings + units untouched). Remove unit now confirms. Dashboard: "saved on this device only" notice + **Back up all jobs** (Import accepts single job or full backup array), search, quote total per card, **Duplicate**. Phone fix at 320 px: cost rows stack, carcass size label wraps.
- **2026-10-06 (grouping):** Cut list has one **Board cut list** (no separate "Doors & drawers" section). One table per **board material + edging tape (name + thickness)**, e.g. "White 16mm — PVC White (1 mm)" and "White 16mm — PVC White (2 mm)" are separate tables. Carcass, door and drawer parts sit together; the Edging column shows only the pattern. "No edging" tables come last for each board. Masonite stays separate. `groupBoardCutList` in `calculator.ts`; result field `boardGroups`.
- **2026-10-06 (grain):** On boards with **Grain** ticked, sides, doors and drawer fronts are grain-locked: the grain runs along the first size (Length = part height, top to bottom). Cut list and PDF show a **Grain** column ("Top to bottom", including wood kickplates on grain boards). Sheet count for grain boards comes from a layout in `src/lib/sheetLayout.ts` (sheet grain = long side, e.g. 2750; locked parts never rotated, other parts may rotate; configurable saw kerf in Job settings, default 4 mm). The last sheet is rounded up to ¼ sheet, and the result is never below the old area estimate. Parts taller than the sheet's grain length get a warning. Boards without grain still use the plain area estimate.
- **2026-10-06:** Materials Gelmar **Refresh** buttons (runners, hinges, screws, connecting fittings) call `/api/gelmar-*` and write live prices into the current job. Local: Vite middleware (`npm run dev` / `preview`, port 5199). **Vercel:** `api/gelmar-*.js` + `vercel.json` (no env vars). Blum/Hettich/generic runner presets stay hardcoded.
- **2026-10-08:** Vercel serverless Gelmar APIs added for production Refresh; SPA rewrite excludes `/api/*`.
- **2026-10-09:** Mobile unit form: responsive `auto-fit` grids + drawer box hints moved out of grid so material/edging selects are full width on phone.
- **2026-10-09:** Cut list tab **Client quote** + portrait PDF (`quotePdf.ts`) — scope, supply/install totals, exclusions; no panel sizes (Factory/Full unchanged).
- **2026-10-09:** SA quote polish (2–8): VAT breakdown, board wastage %, backup reminder, mobile edging table, sheet presets, runner price note, editable quote terms; dashboard quote incl VAT when enabled.
- **2026-10-09:** **Board offcuts** on **full** cut list + full PDF only (not factory) — from sheet nesting; board wastage % is quote sheet count only, not offcut geometry.
- **2026-10-09:** **NumberInput** — mobile-friendly numeric fields (clear/retype without snapping to 0); replaces `type="number"` on units/prices forms.
- **2026-10-09:** **Quote currency** — Job settings dropdown (ZAR default + regional/common codes); `formatMoney` drives cut list, dashboard, full PDF, client quote PDF. No FX conversion — you enter amounts in that currency.
- **2026-10-09:** **Hardware pricing mode** — per category (runners, hinges, screws, connecting fittings): checkbox *Use Gelmar catalog & live refresh* (default on). Off → custom product table (description + price; pack qty for screws/fittings). Stored on job + **My default prices** (`hardwarePricing` in `priceList.ts`). Unit dropdowns use custom catalog via `hardwarePricing.ts`.
- **2026-10-09:** **Premium roadmap** captured in `docs/premium-roadmap.md` (sync, branded PDF, CRM, PayFast, sheet maps, etc.).
- **2026-10-09:** **Visual sheet maps** — Factory + Full cut list tabs show SVG nest per material/sheet (`sheetLayout.ts` placements, `SheetMapView.tsx`); same engine as offcuts. PWA + brand bar from earlier same day.

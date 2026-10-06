# Project: Cuboards

> Tier 2 of the Information Hierarchy. Read `../_ABOUT-ME/` first.

## What it is
Professional **cut-list software for kitchen & bedroom cupboard installers**. Calculates
carcasses, doors, drawers, edging, hardware, cost estimates, and exports a PDF cut-list.
Strong candidate to sell as a tool/subscription to installers.

## Stack & key paths
- **Vite + TypeScript** web app. Source in `src/`, built site in `dist/`.
- `Start Cuboards.bat` launches it; dev: `npm install` then `npm run dev`
  (http://localhost:5173). See `README.md`.
- Docs in `docs/`.

## Status
Active (v1 feature set built: client jobs, calculators, edging, hardware, PDF export).

## Notes
- _Add pricing/packaging plan and installer feedback here._
- **2026-10-06:** Cut-list calc fixes (backup `Backup/calc_20261006_123807/`): 1-long edging uses the front/top run not max(W,H); drawer box front/back sits between sides (−2T); side depth = D − front − back clearance; drop-in bottoms (no groove); wooden top is one full panel not fillers+top; Blum length rounds down to 50 mm; hinges 5 above 2 m; screw fronts use qty×frontQty. For a drawer tower add one row per height — qty 4 on one row is four matching boxes.
- **2026-10-06:** Materials Gelmar **Refresh** buttons (runners, hinges, screws, connecting fittings) call Vite APIs (`/api/gelmar-runners`, `gelmar-hinges`, `gelmar-screws`, `gelmar-connecting-fittings`) and write live prices into the current job. Works on `npm run dev` and `npm run preview` (port 5199). Blum/Hettich/generic runner presets stay hardcoded.

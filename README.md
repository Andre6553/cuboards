# Cuboards

Professional cut-list software for kitchen and bedroom cupboard installers.

## Features (v1)

- **Client jobs** — save, edit, export/import JSON
- **Carcass calculator** — sides, bottom, shelves, front/back fillers
- **Dual materials** — different board per side (visible vs plain)
- **Doors** — auto width from opening + gaps, edging patterns
- **Drawers** — runner presets (Blum, Hettich) or custom clearances, masonite/solid bottom
- **Edging summary** — linear metres per part
- **Hardware list** — runner lengths
- **Cost estimate** — sheets × price per 2750×1830 board
- **PDF export** — ready for your cutter

## Quick start

1. Install [Node.js](https://nodejs.org) (LTS) if not already installed
2. Double-click **`Start Cuboards.bat`**
3. Browser opens at `http://localhost:5199`

## Manual start

```bash
npm install
npm run dev
```

## Build for offline folder

```bash
npm run build
```

Output is in `dist/` — serve with any static file server or use the batch file.

## Data storage

Jobs are saved in your browser **localStorage** on this PC. Use **Export** on the dashboard to back up a job as JSON.

## Defaults

| Setting | Default |
|---------|---------|
| Board thickness | 16 mm (or 18 mm per job) |
| Sheet size | 2750 × 1830 mm |
| Door gap | 2 mm |
| Top filler width | 100 mm |

## Project structure

```
src/
  lib/calculator.ts   — cut list engine
  lib/pdf.ts          — PDF export
  lib/storage.ts      — job persistence
  components/         — UI
```

## Roadmap

- Sheet nesting optimiser
- Edging tape costing (per linear metre)
- Back panel option
- Bedroom hanging rail modules
- Invoice / quote PDF

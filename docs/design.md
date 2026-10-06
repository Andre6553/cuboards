# Cuboards v1 Design Spec

**Date:** 2026-06-13  
**Status:** Approved — implementation started

## Summary

Local web app for cupboard installers to enter kitchen/bedroom unit dimensions, generate cut lists with edging specs, hardware (drawer runners), and material cost estimates. PDF export for cutters.

## Decisions

| Topic | Choice |
|-------|--------|
| Platform | Local web app (Vite + React) |
| Board thickness | 16 or 18 mm per job (default 16) |
| Runners | Presets + custom |
| Costing | Price per full sheet (2750×1830 mm) |
| v1 scope | Carcass + doors + drawers + PDF + jobs |

## Carcass

- 2 side panels: H × D (grain vertical when material has grain)
- Bottom: (W−2T) × D
- Shelves × n: (W−2T) × D
- Top fillers front/back: (W−2T) × filler width
- Edging: visible sides 1 long; bottom/shelf/fillers 1 long each

## Doors

- Width = (openingWidth − (qty+1)×gap) / qty
- Height = openingHeight − 2×gap
- User selects edging pattern

## Drawers

- Front/back width = internal − 2×runner clearance − 2×T
- Side depth = D − depth deduction − clearances
- Bottom: solid melamine or masonite (grooved)
- Hardware: runner pair length per drawer

## Storage

Browser localStorage + JSON export/import.

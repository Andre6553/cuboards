# Plinth Corner (Flexible Aluminium) — Design

_Date: 2026-11-18_  
_Project: cuboards_  
_Status: approved in chat; awaiting final review of this written spec_

## Goal

When a unit uses **plastic strip** kickplate with side coverage, automatically include matching Gelmar **Plinth Corner, Flexible, Aluminium** pieces in cut-list hardware and hardware shopping, priced from Prices & Settings (editable + optional Gelmar refresh). Hardware totals must include these corners.

## Products (Gelmar)

| Height | Name | Approx SKU | URL | Default price each |
|--------|------|------------|-----|--------------------|
| 100 mm | Plinth Corner, Flexible, Aluminium, 100mm | 6066 | https://www.gelmar.co.za/plinth-corner-flexible-aluminium-100mm.html | R8 |
| 150 mm | Plinth Corner, Flexible, Aluminium, 150mm | 6795 | https://www.gelmar.co.za/plinth-corner-flexible-aluminium-150mm.html | R11 |

Images: Gelmar catalog product images (same pattern as PVC plinth strips).

## Quantity rules (per cupboard)

Applies only when:

- Unit shows kickplate / plinth, and
- `kickplateType === 'plastic'`, and
- Plinth has kickplate enabled

| `kickplateCoverage` | Corners per cupboard |
|---------------------|----------------------|
| `front` | 0 |
| `front-one-side` | 1 |
| `front-both-sides` | 2 |

- Corner height matches unit `kickplateHeight` after the same 100/150 snap used for PVC strips.
- Multiply by cupboard quantity (`mult`).
- Wood kickplate: never add corners.

## Data model

Extend `PlasticKickplateConfig` (job + My default prices / price lists):

```ts
gelmarCornerPriceEachByHeight?: { 100?: number; 150?: number };
```

- Defaults when missing: `{ 100: 8, 150: 11 }`.
- Normalization lives next to existing `normalizePlasticKickplate`.
- Catalog constants in (or beside) `gelmarKickplateCatalog.ts`, e.g. `GELMAR_PLINTH_CORNER_PRODUCTS`.

No per-unit product picker for corners — selection is fully driven by height + coverage.

## Prices & Settings UI

Under **Plastic kickplate strip**:

- List both corner products (name, height, link).
- Editable **price each** for 100 mm and 150 mm.
- When Gelmar catalog mode is on, support live refresh for corner unit prices (API/scrape path parallel to `/api/gelmar-kickplate`), keeping manual overrides editable.
- Persist via existing job / price-list / default-prices paths that already carry `plasticKickplate`.

## Calculator / cut list

In `calcKitchenPlinth` (after plastic strip lines, same function that adds feet):

- If qty rules yield `n > 0`, push a `HardwareItem`:
  - `description`: catalog name for height (e.g. `Plinth Corner, Flexible, Aluminium, 100mm`)
  - `qty`: `n * mult` (or `n` already including mult — be consistent with feet)
  - `detail`: coverage label, height, SKU
  - `pricePerPair`: price each from config
  - `subtotal`: qty × price each

Do **not** put corners into the plastic-metres / strip-purchase tables. Corners are **each**, not metres.

Hardware money totals already sum `hardware[].subtotal` (excluding the synthetic plastic-strip hardware line that is costed in the Plastic kickplate table). Corners stay in hardware and are included in those totals.

## Hardware shopping

- Map corner hardware lines via catalog SKU/url/image (extend `supplierForHardware` / catalog lookup).
- Merge identical SKUs across units; accumulate qty and subtotal.
- Item total and Grand Total already include `subtotal` — corners must contribute.

## PDF / cut-list views

No special new section required: corners appear in the existing Hardware table and shopping PDF. Ensure they are not filtered out (unlike `Plastic kickplate strip`).

## Testing

- Qty: front → 0; one side → 1; both sides → 2; × mult.
- Height: 100 → 6066 product/price; 150 → 6795.
- Totals: hardware sum and shopping grand total include corner money.
- Wood / front-only plastic: no corner lines.

## Out of scope

- Corners for wood kickplates.
- Manual per-unit override of corner qty/product.
- Changing PVC strip buy/billing rules.

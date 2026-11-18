# Plinth Corner Hardware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-add Gelmar flexible aluminium plinth corners (100/150 mm) to hardware + shopping when plastic kickplate has side coverage, with editable Prices & Settings and optional Gelmar refresh.

**Architecture:** Extend `PlasticKickplateConfig` with per-height corner prices; catalog constants for SKU/URL/image; qty helper in `kickplateRules`; calculator pushes `HardwareItem` lines; shopping resolves catalog; MaterialsForm shows prices + refresh API for corner unit prices.

**Tech Stack:** Vite/TypeScript Cuboards, Vitest, existing Gelmar scrape helpers.

## Global Constraints

- Qty: front=0, front-one-side=1, front-both-sides=2 per cupboard × mult; height snap 100/150.
- Defaults: R8 (100) / R11 (150); SKUs 6066 / 6795.
- Corners are each (not metres); include in hardware money totals.
- Wood kickplate: no corners.

---

### Task 1: Catalog + qty/price helpers (TDD)

**Files:**
- Modify: `src/lib/gelmarKickplateCatalog.ts`
- Modify: `src/types/index.ts` (`PlasticKickplateConfig`)
- Modify: `src/lib/constants.ts` (`DEFAULT_PLASTIC_KICKPLATE`)
- Modify: `src/lib/kickplateRules.ts`
- Test: `src/lib/kickplateRules.plinthCorner.test.ts`

**Interfaces:**
- Produces: `GELMAR_PLINTH_CORNER_PRODUCTS`, `gelmarPlinthCornerProduct(heightMm)`, `plinthCornerQtyPerCupboard(coverage)`, `resolvePlinthCornerPriceEach(config, heightMm)`, `withGelmarCornerPrice(config, height, priceEach)`, normalize seeds corner defaults.

- [ ] **Step 1:** Write failing tests for qty (0/1/2), height product, price resolve, normalize defaults.
- [ ] **Step 2:** Implement catalog + helpers until tests pass.
- [ ] **Step 3:** Commit.

### Task 2: Calculator hardware lines (TDD)

**Files:**
- Modify: `src/lib/calculator.ts` (`calcKitchenPlinth`)
- Test: `src/lib/calculator.plinthCorner.test.ts`

- [ ] **Step 1:** Failing tests: plastic+one-side → 1 corner; both → 2; front → 0; wood → 0; mult; shopping/hardware subtotal.
- [ ] **Step 2:** Push hardware in `calcKitchenPlinth`.
- [ ] **Step 3:** Commit.

### Task 3: Hardware shopping catalog wiring

**Files:**
- Modify: `src/lib/hardwareShopping.ts`
- Modify: `src/lib/hardwareShopping.test.ts`

- [ ] Wire SKU/url/image for plinth corner descriptions; assert merge + subtotal.
- [ ] Commit.

### Task 4: Prices & Settings UI + Gelmar corner refresh

**Files:**
- Modify: `src/components/MaterialsForm.tsx`
- Create: `scripts/gelmar-plinth-corner-lib.mjs`, `api/gelmar-plinth-corner.js` (price each, not R/m)

- [ ] UI rows for 100/150 corner price each + refresh when Gelmar on.
- [ ] Commit.

### Task 5: Verify

- [ ] `npm test -- --run` for touched tests + `npx tsc --noEmit`
- [ ] Update `PROJECT.md` note briefly

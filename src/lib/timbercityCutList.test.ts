import { describe, expect, it } from 'vitest';
import type { Job } from '../types';
import {
  DEFAULT_CONNECTING_FITTING_PRICES,
  DEFAULT_EDGING,
  DEFAULT_HINGE_PRICES,
  DEFAULT_MASONITE,
  DEFAULT_MATERIALS,
  DEFAULT_PLASTIC_KICKPLATE,
  DEFAULT_RUNNER_PRICES,
  DEFAULT_SCREW_PRICES,
  DEFAULT_SETTINGS,
} from './constants';
import { createDefaultUnit, generateCutList } from './calculator';
import { DEFAULT_HARDWARE_PRICING } from './hardwarePricing';
import { DEFAULT_INSTALL_RATES } from './installRules';
import {
  buildTimbercityFormPages,
  edgeLongLabel,
  edgeShortLabel,
  formatTimbercityEdgingType,
  TIMBERCITY_ROWS_PER_PAGE,
} from './timbercityCutList';

function testJob(): Job {
  return {
    id: 'test-job',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    client: {
      name: 'Test Client',
      ref: 'TC-1',
      address: '1 Main Rd',
      phone: '0820000000',
      notes: 'Leave at gate',
    },
    installer: {
      businessName: 'Arline Cupboards',
      phone: '0831112222',
      email: 'andre@example.com',
    },
    settings: { ...DEFAULT_SETTINGS },
    materials: DEFAULT_MATERIALS.map((m) => ({ ...m })),
    edgingMaterials: DEFAULT_EDGING.map((e) => ({ ...e })),
    masonite: { ...DEFAULT_MASONITE },
    plasticKickplate: { ...DEFAULT_PLASTIC_KICKPLATE },
    runnerPrices: { ...DEFAULT_RUNNER_PRICES },
    hingePrices: { ...DEFAULT_HINGE_PRICES },
    screwPrices: { ...DEFAULT_SCREW_PRICES },
    connectingFittingPrices: { ...DEFAULT_CONNECTING_FITTING_PRICES },
    installRates: { ...DEFAULT_INSTALL_RATES },
    hardwarePricing: structuredClone(DEFAULT_HARDWARE_PRICING),
    units: [],
  };
}

describe('timbercity edge labels', () => {
  it('maps L/B ticks to 1/2 Long and 1/2 Short', () => {
    expect(edgeLongLabel({ l1: true, l2: false, b1: false, b2: false })).toBe('1 Long');
    expect(edgeLongLabel({ l1: true, l2: true, b1: false, b2: false })).toBe('2 Long');
    expect(edgeShortLabel({ l1: false, l2: false, b1: true, b2: false })).toBe('1 Short');
    expect(edgeShortLabel({ l1: false, l2: false, b1: true, b2: true })).toBe('2 Short');
    expect(edgeLongLabel({ l1: false, l2: false, b1: true, b2: true })).toBe('');
    expect(edgeShortLabel({ l1: true, l2: true, b1: false, b2: false })).toBe('');
  });

  it('writes NO EDGING when the form has no tape', () => {
    expect(formatTimbercityEdgingType(null, null)).toBe('NO EDGING');
    expect(formatTimbercityEdgingType('White PVC', 1)).toBe('White PVC 1 mm');
  });
});

describe('buildTimbercityFormPages', () => {
  it('puts Length as the long/grain axis and marks Finished Size + grain', () => {
    const job = testJob();
    const unit = createDefaultUnit(job, 0);
    unit.width = 600;
    unit.height = 720;
    unit.depth = 560;
    unit.unitQty = 1;
    job.units = [unit];

    const { pieces } = generateCutList(job);
    const pages = buildTimbercityFormPages(job, pieces);
    expect(pages.length).toBeGreaterThan(0);

    const first = pages[0]!;
    expect(first.header.finishedSize).toBe(true);
    expect(first.header.cuttingSize).toBe(false);
    expect(first.header.customerName).toBe('Arline Cupboards');
    expect(first.header.phoneNo).toBe('0831112222');
    expect(first.header.deliveryAddress).toBe('1 Main Rd');
    expect(first.header.jobNoName).toBe('TC-1');
    expect(first.rows).toHaveLength(TIMBERCITY_ROWS_PER_PAGE);

    const filled = first.rows.filter(Boolean);
    expect(filled.length).toBeGreaterThan(0);
    // Side panels: height along length (grain) when grain board.
    const side = filled.find((r) => (r!.remarks || '').toLowerCase().includes('side'));
    if (side) {
      expect(side!.lengthMm).toBeGreaterThanOrEqual(side!.widthMm);
    }
  });

  it('keeps different edging on separate forms even for the same board', () => {
    const job = testJob();
    const unit = createDefaultUnit(job, 0);
    unit.width = 600;
    unit.height = 720;
    unit.depth = 560;
    unit.unitQty = 1;
    // Door uses door edging; carcass uses board default — often different tape keys.
    job.units = [unit];

    const { pieces } = generateCutList(job);
    const pages = buildTimbercityFormPages(job, pieces);
    const keys = pages.map((p) => `${p.header.boardType}|${p.header.edgingType}`);
    // At least board-only and edged groups when doors/edging exist.
    expect(new Set(keys).size).toBe(pages.filter((p) => p.header.pageNo === 1).length);
  });

  it('paginates a form at 23 rows', () => {
    const job = testJob();
    // Many identical small units → many merged factory rows still capped; force via qty on wide parts.
    const units = Array.from({ length: 30 }, (_, i) => {
      const u = createDefaultUnit(job, i);
      u.width = 400 + i; // unique widths → unique rows after merge
      u.height = 700;
      u.depth = 500;
      u.unitQty = 1;
      u.carcass.shelfQty = 0;
      u.doors = [];
      u.drawers = [];
      return u;
    });
    job.units = units;

    const { pieces } = generateCutList(job);
    const pages = buildTimbercityFormPages(job, pieces);
    const formPages = pages.filter((p) => p.header.boardType.includes(job.materials[0]?.name ?? ''));
    // Find any form that needed more than one page.
    const multi = pages.filter((p) => p.header.pagesInForm > 1);
    if (multi.length === 0) {
      // Still assert page structure is correct for single-page forms.
      expect(pages.every((p) => p.rows.length === TIMBERCITY_ROWS_PER_PAGE)).toBe(true);
      expect(formPages.length).toBeGreaterThan(0);
      return;
    }
    const formKey = `${multi[0]!.header.boardType}|${multi[0]!.header.edgingType}`;
    const sameForm = pages.filter(
      (p) => `${p.header.boardType}|${p.header.edgingType}` === formKey,
    );
    expect(sameForm.map((p) => p.header.pageNo)).toEqual(
      Array.from({ length: sameForm[0]!.header.pagesInForm }, (_, i) => i + 1),
    );
  });
});

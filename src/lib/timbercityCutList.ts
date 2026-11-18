import type { CutPiece, Job } from '../types';
import {
  buildFactoryCutListGroups,
  type FactoryCutListGroup,
  type FactoryCutListRow,
  type FactoryEdgingTicks,
} from './factoryCutList';
import { normalizeInstallerDetails } from './installerDetails';

/** Timbercity Client Cutting List — rows per printed page. */
export const TIMBERCITY_ROWS_PER_PAGE = 23;

export interface TimbercityFormHeader {
  date: string;
  /** 1-based page index across the whole Timbercity document (all board+edging forms). */
  pageNo: number;
  /** Total pages in this Timbercity document (shown as Page No `1/5`). */
  totalPages: number;
  customerName: string;
  phoneNo: string;
  /** Installer business email. */
  email: string;
  deliveryAddress: string;
  jobNoName: string;
  boardType: string;
  edgingType: string;
  grainYes: boolean;
  /** Always Finished Size for Timbercity. */
  finishedSize: true;
  cuttingSize: false;
  salesPerson: string;
  specialInstructions: string;
}

export interface TimbercityFormRow {
  lengthMm: number;
  widthMm: number;
  qty: number;
  edgeLength: string;
  edgeWidth: string;
  holes: string;
  remarks: string;
}

export interface TimbercityFormPage {
  header: TimbercityFormHeader;
  /** Always length TIMBERCITY_ROWS_PER_PAGE (empty slots are blank). */
  rows: Array<TimbercityFormRow | null>;
}

function countLongTicks(e: FactoryEdgingTicks): number {
  return (e.l1 ? 1 : 0) + (e.l2 ? 1 : 0);
}

function countShortTicks(e: FactoryEdgingTicks): number {
  return (e.b1 ? 1 : 0) + (e.b2 ? 1 : 0);
}

/** Edge Length column: 1 Long / 2 Long (blank if none). */
export function edgeLongLabel(ticks: FactoryEdgingTicks): string {
  const n = countLongTicks(ticks);
  if (n <= 0) return '';
  return n === 1 ? '1 Long' : '2 Long';
}

/** Edge Width column: 1 Short / 2 Short (blank if none). */
export function edgeShortLabel(ticks: FactoryEdgingTicks): string {
  const n = countShortTicks(ticks);
  if (n <= 0) return '';
  return n === 1 ? '1 Short' : '2 Short';
}

export function formatTimbercityEdgingType(
  edgingType: string | null,
  thicknessMm: number | null,
): string {
  if (!edgingType) return 'NO EDGING';
  if (thicknessMm != null && Number.isFinite(thicknessMm)) {
    return `${edgingType} ${thicknessMm} mm`;
  }
  return edgingType;
}

function groupHasGrain(group: FactoryCutListGroup, job: Job): boolean {
  if (group.rows.some((r) => r.finish && r.finish !== '—')) return true;
  const board = group.groupHeading.boardType;
  const mat = job.materials.find((m) => m.name === board);
  return Boolean(mat?.hasGrain);
}

function remarksForRow(row: FactoryCutListRow): string {
  const parts = [row.unitId, row.description].filter((p) => p && p !== '—');
  return parts.join(' · ');
}

function holesForRow(row: FactoryCutListRow): string {
  if (!row.hingeHoles || row.hingeHoles === '—' || row.hingeHoles === 'No') return '';
  if (row.hingeHoles === 'Yes') return 'Yes';
  return row.hingeHoles;
}

export function factoryRowToTimbercityRow(row: FactoryCutListRow): TimbercityFormRow {
  return {
    lengthMm: row.lengthMm,
    widthMm: row.widthMm,
    qty: row.qty,
    edgeLength: edgeLongLabel(row.edging),
    edgeWidth: edgeShortLabel(row.edging),
    holes: holesForRow(row),
    remarks: remarksForRow(row),
  };
}

function todayDisplayDate(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function paginateGroup(
  job: Job,
  group: FactoryCutListGroup,
): TimbercityFormPage[] {
  const dataRows = group.rows.map(factoryRowToTimbercityRow);
  const pageCount = Math.max(1, Math.ceil(dataRows.length / TIMBERCITY_ROWS_PER_PAGE));
  const grainYes = groupHasGrain(group, job);
  const edgingType = formatTimbercityEdgingType(
    group.groupHeading.edgingType,
    group.groupHeading.thicknessMm,
  );
  const boardColour = group.rows[0]?.boardColour;
  const boardType =
    boardColour && boardColour !== '—' && boardColour !== group.groupHeading.boardType
      ? `${group.groupHeading.boardType} (${boardColour})`
      : group.groupHeading.boardType;

  const pages: TimbercityFormPage[] = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const slice = dataRows.slice(
      pageIndex * TIMBERCITY_ROWS_PER_PAGE,
      (pageIndex + 1) * TIMBERCITY_ROWS_PER_PAGE,
    );
    const rows: Array<TimbercityFormRow | null> = Array.from(
      { length: TIMBERCITY_ROWS_PER_PAGE },
      (_, i) => slice[i] ?? null,
    );
    const installer = normalizeInstallerDetails(job.installer);
    pages.push({
      header: {
        date: todayDisplayDate(),
        // Filled in by buildTimbercityFormPages once the full document length is known.
        pageNo: 0,
        totalPages: 0,
        // Timbercity “Customer” fields are the installer’s trade account at the cut house.
        customerName: installer.businessName,
        phoneNo: installer.phone,
        email: installer.email,
        deliveryAddress: job.client.address?.trim() || '',
        jobNoName: job.client.ref?.trim() || job.client.name?.trim() || '',
        boardType,
        edgingType,
        grainYes,
        finishedSize: true,
        cuttingSize: false,
        salesPerson: '',
        specialInstructions: job.client.notes?.trim() || '',
      },
      rows,
    });
  }
  return pages;
}

/** Page No label for the Timbercity blank, e.g. `1/5`. */
export function timbercityPageLabel(pageNo: number, totalPages: number): string {
  const total = Math.max(1, totalPages);
  const n = Math.max(1, pageNo);
  return `${n}/${total}`;
}

/**
 * One Timbercity form (possibly multi-page) per board type + edging tape.
 * Different edging never shares a form with the same board.
 * Page numbers run across the whole document (`1/5`, `2/5`, …).
 */
export function buildTimbercityFormPages(job: Job, pieces: CutPiece[]): TimbercityFormPage[] {
  const groups = buildFactoryCutListGroups(job, pieces);
  const pages = groups.flatMap((g) => paginateGroup(job, g));
  const totalPages = Math.max(1, pages.length);
  return pages.map((page, index) => ({
    ...page,
    header: {
      ...page.header,
      pageNo: index + 1,
      totalPages,
    },
  }));
}

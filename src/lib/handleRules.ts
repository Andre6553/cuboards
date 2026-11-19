import type { HandleCount, Job, PartHandle } from '../types';
import {
  getHandleByIdForJob,
  resolveHandleUnitPrice,
  usesGelmarCatalog,
} from './hardwarePricing';
import type { HandleCatalogEntry } from './handleCatalog';

export const DEFAULT_HANDLE_COUNT: HandleCount = 1;
export const HANDLE_COUNT_OPTIONS: HandleCount[] = [1, 2, 3];
export const CABINET_HANDLE_DESCRIPTION = 'Cabinet handle';

/** Drop per-door / per-front suffixes so the same SKU nests cleanly. */
export function nestHandleDetail(detail: string): string {
  return detail
    .replace(/\s*·\s*\d+\/(?:door|front)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s·\s·/g, ' · ')
    .trim();
}

export function resolveHandleCount(count?: HandleCount | number | null): HandleCount {
  const n = Number(count);
  if (n === 2 || n === 3) return n;
  return 1;
}

/** Effective handle selection for a door/drawer (inherits job default when unset). */
export function resolvePartHandle(handle: PartHandle | undefined, job: Job): PartHandle {
  if (!handle || handle.type === 'job_default') {
    const id = job.settings.defaultHandleId;
    if (id) return { type: 'preset', presetId: id };
    return { type: 'job_default' };
  }
  return handle;
}

export function resolveHandleCatalogEntry(
  handle: PartHandle | undefined,
  job: Job,
): HandleCatalogEntry | undefined {
  const resolved = resolvePartHandle(handle, job);
  if (resolved.type === 'custom') return undefined;
  if (resolved.type !== 'preset' || !resolved.presetId) return undefined;
  return getHandleByIdForJob(job, resolved.presetId);
}

export function resolveHandlePriceEach(handle: PartHandle | undefined, job: Job): number {
  const resolved = resolvePartHandle(handle, job);
  if (resolved.type === 'custom') {
    return resolved.customUnitPrice ?? job.handlePrices?.custom ?? 0;
  }
  if (resolved.type === 'preset' && resolved.presetId) {
    return resolveHandleUnitPrice(job, resolved.presetId);
  }
  return 0;
}

export function handleDisplayName(handle: PartHandle | undefined, job: Job): string {
  const resolved = resolvePartHandle(handle, job);
  if (resolved.type === 'custom') return 'Custom handle';
  const entry = resolveHandleCatalogEntry(handle, job);
  if (entry) return entry.name;
  if (!job.settings.defaultHandleId) return 'No handle selected';
  return 'Handle';
}

export function isUsingJobDefaultHandle(handle: PartHandle | undefined): boolean {
  return !handle || handle.type === 'job_default';
}

export function jobDefaultHandleEntry(job: Job): HandleCatalogEntry | undefined {
  return getHandleByIdForJob(job, job.settings.defaultHandleId);
}

export function handleUsesGelmar(job: Job): boolean {
  return usesGelmarCatalog(job, 'handles');
}

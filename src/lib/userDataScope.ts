/** Active Supabase user — all job/catalog localStorage keys are scoped per account. */
let activeUserId: string | null = null;

export function setUserDataScope(userId: string | null): void {
  activeUserId = userId;
}

export function getUserDataScope(): string | null {
  return activeUserId;
}

export function requireUserDataScope(): string {
  if (!activeUserId) {
    throw new Error('User data scope not set — sign in required.');
  }
  return activeUserId;
}

function scopedKey(base: string): string {
  return `${base}_${requireUserDataScope()}`;
}

export const userStorageKeys = {
  jobs: () => scopedKey('cuboards_jobs'),
  boardCatalog: () => scopedKey('cuboards_board_catalog'),
  priceList: () => scopedKey('cuboards_price_list'),
};

const LEGACY_JOBS = 'cuboards_jobs';
const LEGACY_CATALOG = 'cuboards_board_catalog';
const LEGACY_PRICE_LIST = 'cuboards_price_list';

/** One-time move of pre-sync local data into this account’s scoped keys (then delete globals). */
export function adoptLegacyDeviceStorageIfEmpty(): boolean {
  requireUserDataScope();
  if (localStorage.getItem(userStorageKeys.jobs())) return false;

  const legacyJobs = localStorage.getItem(LEGACY_JOBS);
  if (!legacyJobs) return false;

  localStorage.setItem(userStorageKeys.jobs(), legacyJobs);

  const legacyCatalog = localStorage.getItem(LEGACY_CATALOG);
  if (legacyCatalog && !localStorage.getItem(userStorageKeys.boardCatalog())) {
    localStorage.setItem(userStorageKeys.boardCatalog(), legacyCatalog);
  }

  const legacyPrice = localStorage.getItem(LEGACY_PRICE_LIST);
  if (legacyPrice && !localStorage.getItem(userStorageKeys.priceList())) {
    localStorage.setItem(userStorageKeys.priceList(), legacyPrice);
  }

  localStorage.removeItem(LEGACY_JOBS);
  localStorage.removeItem(LEGACY_CATALOG);
  localStorage.removeItem(LEGACY_PRICE_LIST);
  return true;
}

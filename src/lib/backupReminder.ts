const LAST_BACKUP_KEY = 'cuboards_last_backup';

export function recordJobsBackup(): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  } catch {
    /* ignore quota errors */
  }
}

export function getLastBackupIso(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

/** True when user has jobs but no backup in the last 7 days. */
export function shouldShowBackupReminder(jobCount: number): boolean {
  if (jobCount <= 0) return false;
  const last = getLastBackupIso();
  if (!last) return true;
  const ageMs = Date.now() - new Date(last).getTime();
  return ageMs > 7 * 24 * 60 * 60 * 1000;
}

export function formatLastBackup(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-ZA');
}

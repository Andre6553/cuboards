import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'cuboards_install_id';

/** Stable per-browser install id — used to grant only one 90-day trial per device profile. */
export function getDeviceInstallId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return uuidv4();
  }
}

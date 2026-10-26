import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'cuboards_install_id';

/** Stable per-browser install id — used for device/login analytics via finalize_cuboards_signup. */
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

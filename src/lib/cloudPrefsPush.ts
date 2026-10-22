let prefsUserId: string | null = null;
let prefsPushTimer: ReturnType<typeof setTimeout> | null = null;
let onPushed: (() => void) | null = null;
let pushImpl: ((userId: string) => Promise<void>) | null = null;

export function registerCloudPrefsPushImpl(fn: (userId: string) => Promise<void>): void {
  pushImpl = fn;
}

export function setCloudPrefsPushContext(userId: string | null, afterPush: (() => void) | null): void {
  prefsUserId = userId;
  onPushed = afterPush;
}

export function scheduleCloudPrefsPush(): void {
  if (!prefsUserId || !pushImpl) return;
  if (prefsPushTimer) clearTimeout(prefsPushTimer);
  const uid = prefsUserId;
  const run = pushImpl;
  prefsPushTimer = setTimeout(() => {
    void run(uid)
      .then(() => onPushed?.())
      .catch((e) => console.error('pushUserPrefs', e));
  }, 800);
}

/** @deprecated use scheduleCloudPrefsPush */
export function schedulePushUserPrefs(): void {
  scheduleCloudPrefsPush();
}

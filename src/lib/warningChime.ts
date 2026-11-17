/**
 * Short warning beep (Web Audio). Works on desktop; mobile usually needs a
 * prior user tap to unlock audio (we unlock on first pointer/keydown).
 */

let ctx: AudioContext | null = null;
let lastPlayedAt = 0;
const MIN_GAP_MS = 600;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Call once from UI so mobile browsers allow later beeps. */
export function unlockWarningChime(): void {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') void audio.resume();
}

export function playWarningChime(): void {
  const now = Date.now();
  if (now - lastPlayedAt < MIN_GAP_MS) return;
  lastPlayedAt = now;

  const audio = getCtx();
  if (!audio) return;

  const start = () => {
    const t0 = audio.currentTime;
    // Two soft tones so it reads as an alert, not a click.
    for (const [i, freq] of [880, 660].entries()) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const startAt = t0 + i * 0.12;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.14);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(startAt);
      osc.stop(startAt + 0.16);
    }
  };

  if (audio.state === 'suspended') {
    void audio.resume().then(start).catch(() => {});
  } else {
    start();
  }
}

let listenersBound = false;

/** Bind once: unlock audio after first user gesture (needed on many phones). */
export function bindWarningChimeUnlock(): void {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;
  const once = () => {
    unlockWarningChime();
    window.removeEventListener('pointerdown', once);
    window.removeEventListener('keydown', once);
  };
  window.addEventListener('pointerdown', once, { passive: true });
  window.addEventListener('keydown', once);
}

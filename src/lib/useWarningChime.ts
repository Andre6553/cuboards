import { useEffect, useRef } from 'react';
import { bindWarningChimeUnlock, playWarningChime } from './warningChime';

/**
 * `signature` = joined active warning texts (or empty).
 * Chimes when the signature gains a new warning (not when it clears or shrinks).
 */
export function useWarningChime(signature: string): void {
  const prev = useRef('');

  useEffect(() => {
    bindWarningChimeUnlock();
  }, []);

  useEffect(() => {
    const next = signature.trim();
    const prevParts = new Set(prev.current.split('\n').filter(Boolean));
    const nextParts = next.split('\n').filter(Boolean);
    const appeared = nextParts.some((p) => !prevParts.has(p));
    prev.current = next;
    if (appeared) playWarningChime();
  }, [signature]);
}

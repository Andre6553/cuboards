import { describe, expect, it } from 'vitest';
import { canAccessOwnCloudRow } from './cuboardsCloudRowAccess';

const now = new Date('2026-11-01T12:00:00.000Z');
const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('canAccessOwnCloudRow (RLS mirror: own row + subscription)', () => {
  const activeProfile = { access_status: 'active' as const, paid_until: '2099-01-01T00:00:00.000Z' };
  const trialProfile = { access_status: 'trial' as const, trial_use_days_remaining: 5 };
  const expiredProfile = { access_status: 'trial' as const, trial_use_days_remaining: 0 };

  it('allows active subscriber on own jobs/prefs', () => {
    expect(canAccessOwnCloudRow(userA, userA, activeProfile, now)).toBe(true);
  });

  it('allows valid trial on own rows', () => {
    expect(canAccessOwnCloudRow(userA, userA, trialProfile, now)).toBe(true);
  });

  it('denies expired trial on own rows (data retained server-side)', () => {
    expect(canAccessOwnCloudRow(userA, userA, expiredProfile, now)).toBe(false);
  });

  it('denies cross-account even when viewer is active paid', () => {
    expect(canAccessOwnCloudRow(userA, userB, activeProfile, now)).toBe(false);
  });

  it('denies cross-account even when target row would belong to active user', () => {
    expect(canAccessOwnCloudRow(userB, userA, activeProfile, now)).toBe(false);
  });

  it('denies unauthenticated viewer', () => {
    expect(canAccessOwnCloudRow(null, userA, activeProfile, now)).toBe(false);
  });
});

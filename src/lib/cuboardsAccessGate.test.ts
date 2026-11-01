import { describe, expect, it } from 'vitest';
import { cuboardsUserHasAccess, type ProfileAccessRow } from './cuboardsAccessGate';

const now = new Date('2026-11-01T12:00:00.000Z');

describe('cuboardsUserHasAccess (mirrors SQL gate)', () => {
  it('allows active paid subscription with future paid_until', () => {
    const profile: ProfileAccessRow = {
      access_status: 'active',
      paid_until: '2099-12-31T00:00:00.000Z',
    };
    expect(cuboardsUserHasAccess(profile, now)).toBe(true);
  });

  it('allows active with null paid_until (manual/permanent-style rows)', () => {
    expect(cuboardsUserHasAccess({ access_status: 'active', paid_until: null }, now)).toBe(true);
  });

  it('denies active when paid_until is in the past', () => {
    const profile: ProfileAccessRow = {
      access_status: 'active',
      paid_until: '2026-01-01T00:00:00.000Z',
    };
    expect(cuboardsUserHasAccess(profile, now)).toBe(false);
  });

  it('allows trial with use days remaining', () => {
    expect(
      cuboardsUserHasAccess({ access_status: 'trial', trial_use_days_remaining: 12 }, now),
    ).toBe(true);
  });

  it('denies trial with zero use days (expired trial)', () => {
    expect(
      cuboardsUserHasAccess({ access_status: 'trial', trial_use_days_remaining: 0 }, now),
    ).toBe(false);
  });

  it('denies expired and pending', () => {
    expect(cuboardsUserHasAccess({ access_status: 'expired' }, now)).toBe(false);
    expect(cuboardsUserHasAccess({ access_status: 'pending' }, now)).toBe(false);
    expect(cuboardsUserHasAccess(null, now)).toBe(false);
  });

  it('cross-account isolation is not this function — RLS still requires auth.uid() = user_id', () => {
    const otherUserActive: ProfileAccessRow = { access_status: 'active', paid_until: '2099-01-01' };
    expect(cuboardsUserHasAccess(otherUserActive, now)).toBe(true);
    // Gate true for a profile row does not grant access to another user's rows; enforced in SQL policies.
  });
});

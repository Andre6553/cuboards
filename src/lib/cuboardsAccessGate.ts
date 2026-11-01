/**
 * Mirrors public.cuboards_user_has_access() in SQL (read-only; does not consume trial days).
 * Used for unit tests — authoritative enforcement is Supabase RLS + RPC checks.
 */
export type ProfileAccessRow = {
  access_status: 'pending' | 'trial' | 'active' | 'expired';
  trial_use_days_remaining?: number | null;
  paid_until?: string | null;
};

export function cuboardsUserHasAccess(
  profile: ProfileAccessRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!profile) return false;

  if (profile.access_status === 'active') {
    if (profile.paid_until) {
      const paidUntil = new Date(profile.paid_until);
      if (!Number.isNaN(paidUntil.getTime()) && paidUntil < now) return false;
    }
    return true;
  }

  if (profile.access_status === 'trial') {
    return (profile.trial_use_days_remaining ?? 0) > 0;
  }

  return false;
}

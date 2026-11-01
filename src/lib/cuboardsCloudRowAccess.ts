import { cuboardsUserHasAccess, type ProfileAccessRow } from './cuboardsAccessGate';

/** Mirrors RLS: auth.uid() = user_id AND cuboards_user_has_access() (0012). */
export function canAccessOwnCloudRow(
  viewerUserId: string | null | undefined,
  rowUserId: string,
  profile: ProfileAccessRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!viewerUserId || viewerUserId !== rowUserId) {
    return false;
  }
  return cuboardsUserHasAccess(profile ?? null, now);
}

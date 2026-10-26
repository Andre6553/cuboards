export type AccessStatus = 'pending' | 'trial' | 'active' | 'expired';

export interface MyAccess {
  authenticated: boolean;
  access_status?: AccessStatus;
  trial_ends_at?: string | null;
  paid_until?: string | null;
  has_access?: boolean;
  coupon_code?: string | null;
  email?: string;
}

export function parseMyAccess(raw: unknown): MyAccess {
  if (!raw || typeof raw !== 'object') {
    return { authenticated: false };
  }
  const o = raw as Record<string, unknown>;
  return {
    authenticated: Boolean(o.authenticated),
    access_status: o.access_status as AccessStatus | undefined,
    trial_ends_at: (o.trial_ends_at as string | null) ?? null,
    paid_until: (o.paid_until as string | null) ?? null,
    has_access: Boolean(o.has_access),
    coupon_code: typeof o.coupon_code === 'string' && o.coupon_code ? o.coupon_code : null,
    email: typeof o.email === 'string' ? o.email : undefined,
  };
}

export function formatTrialEnds(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Header badge: full label (desktop) and shorter label (mobile). */
export function formatAccessExpiryLabels(access: MyAccess): {
  full: string;
  compact: string;
} | null {
  const ends =
    access.access_status === 'trial'
      ? access.trial_ends_at
      : access.access_status === 'active'
        ? access.paid_until
        : null;
  if (!ends) return null;
  const date = formatTrialEnds(ends);
  if (access.access_status === 'trial') {
    return { full: `Trial until ${date}`, compact: `Trial · ${date}` };
  }
  return { full: `Paid until ${date}`, compact: `Paid · ${date}` };
}

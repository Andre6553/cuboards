export type AccessStatus = 'pending' | 'trial' | 'active' | 'expired';

export interface MyAccess {
  authenticated: boolean;
  access_status?: AccessStatus;
  trial_ends_at?: string | null;
  trial_use_days_remaining?: number | null;
  registered_at?: string | null;
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
    trial_use_days_remaining:
      typeof o.trial_use_days_remaining === 'number' ? o.trial_use_days_remaining : null,
    registered_at: typeof o.registered_at === 'string' ? o.registered_at : null,
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
  if (access.access_status === 'trial') {
    const left = access.trial_use_days_remaining;
    if (left == null || left <= 0) return null;
    const dayWord = left === 1 ? 'day' : 'days';
    return {
      full: `${left} use ${dayWord} left`,
      compact: `${left} left`,
    };
  }
  if (access.access_status === 'active' && access.paid_until) {
    const date = formatTrialEnds(access.paid_until);
    return { full: `Paid until ${date}`, compact: `Paid · ${date}` };
  }
  return null;
}

export type AccessStatus = 'pending' | 'trial' | 'active' | 'expired';

export interface MyAccess {
  authenticated: boolean;
  access_status?: AccessStatus;
  trial_ends_at?: string | null;
  paid_until?: string | null;
  has_access?: boolean;
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

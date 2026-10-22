export function subscriptionPriceLabel(): string {
  return import.meta.env.VITE_SUBSCRIPTION_PRICE_LABEL?.trim() || 'R199/month';
}

const PAYFAST_FIELD_ORDER = [
  'merchant_id',
  'merchant_key',
  'return_url',
  'cancel_url',
  'notify_url',
  'name_first',
  'name_last',
  'email_address',
  'cell_number',
  'm_payment_id',
  'amount',
  'item_name',
  'item_description',
  'signature',
] as const;

function submitPayfastForm(
  processUrl: string,
  fields: Record<string, string>,
  fieldOrder?: string[],
) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = processUrl;
  form.style.display = 'none';
  const order =
    fieldOrder?.length ?
      [...fieldOrder, 'signature'].filter((k, i, a) => a.indexOf(k) === i)
    : [...PAYFAST_FIELD_ORDER];
  const seen = new Set<string>();
  for (const name of order) {
    if (seen.has(name)) continue;
    const value = fields[name];
    if (value === undefined || value === '') continue;
    seen.add(name);
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  for (const [name, value] of Object.entries(fields)) {
    if (seen.has(name) || value === '') continue;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

/** Start PayFast subscription checkout (server signs redirect fields). */
export async function startPayfastSubscription(accessToken: string): Promise<void> {
  const res = await fetch('/api/payfast-initiate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    process_url?: string;
    redirect_url?: string;
    fields?: Record<string, string>;
    field_order?: string[];
  };
  if (!res.ok) {
    throw new Error(data.error || 'Could not start PayFast checkout.');
  }
  try {
    sessionStorage.setItem('cuboards_payfast_return', 'success');
  } catch {
    /* ignore */
  }
  if (data.redirect_url) {
    window.location.assign(data.redirect_url);
    return;
  }
  if (!data.process_url || !data.fields) {
    throw new Error('Could not start PayFast checkout.');
  }
  submitPayfastForm(data.process_url, data.fields, data.field_order);
}

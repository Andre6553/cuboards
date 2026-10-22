export function subscriptionPriceLabel(): string {
  return import.meta.env.VITE_SUBSCRIPTION_PRICE_LABEL?.trim() || 'R199/month';
}

function submitPayfastForm(processUrl: string, fields: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = processUrl;
  form.style.display = 'none';
  for (const [name, value] of Object.entries(fields)) {
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
    fields?: Record<string, string>;
  };
  if (!res.ok || !data.process_url || !data.fields) {
    throw new Error(data.error || 'Could not start PayFast checkout.');
  }
  submitPayfastForm(data.process_url, data.fields);
}

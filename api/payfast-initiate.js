import { createAdminClient, getAppBaseUrl, getUserFromAuthHeader } from './_supabaseAdmin.js'
import { payfastAmount, resolvePayfastCredsFromEnv, signFields } from './_payfast.js'

function subscriptionCents() {
  const raw = process.env.PAYFAST_SUBSCRIPTION_CENTS
  const n = raw ? parseInt(raw, 10) : 19900
  return Number.isFinite(n) && n > 0 ? n : 19900
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { error: authErr, user, admin } = await getUserFromAuthHeader(req)
  if (authErr || !user) {
    res.status(401).json({ error: authErr || 'Unauthorized' })
    return
  }

  const svc = admin ?? createAdminClient()
  if (!svc) {
    res.status(500).json({ error: 'Server not configured.' })
    return
  }

  const amountCents = subscriptionCents()
  const { data: payment, error: insErr } = await svc
    .from('subscription_payments')
    .insert({ user_id: user.id, amount_cents: amountCents, status: 'pending' })
    .select('id')
    .single()

  if (insErr || !payment) {
    console.error('[payfast-initiate] insert', insErr)
    res.status(500).json({ error: 'Could not start payment.' })
    return
  }

  const { sandbox, merchantId, merchantKey, passphrase, processUrl } = resolvePayfastCredsFromEnv()
  if (!merchantId || !merchantKey) {
    res.status(500).json({ error: 'PayFast is not configured on the server.' })
    return
  }

  const base = getAppBaseUrl(req)
  const email = user.email ?? ''
  const firstName = email.split('@')[0] || 'Customer'
  const itemName = sandbox ? 'Cuboards Pro (sandbox)' : 'Cuboards Pro — 1 month'

  const fields = [
    ['merchant_id', merchantId],
    ['merchant_key', merchantKey],
    ['return_url', `${base}/?subscription=success`],
    ['cancel_url', `${base}/?subscription=cancelled`],
    ['notify_url', `${base}/api/payfast-notify`],
    ['name_first', firstName],
    ['email_address', email],
    ['m_payment_id', payment.id],
    ['amount', payfastAmount(amountCents)],
    ['item_name', itemName],
    ['custom_str1', user.id],
    ['custom_str2', payment.id],
  ]

  const out = {}
  for (const [k, v] of fields) {
    if (v !== '') out[k] = v
  }
  out.signature = signFields(fields, passphrase)

  res.status(200).json({
    process_url: processUrl,
    fields: out,
    amount_cents: amountCents,
    sandbox,
  })
}

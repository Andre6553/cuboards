import { createAdminClient } from './_supabaseAdmin.js'
import { payfastAmount, resolvePayfastCredsFromEnv, verifyItnSignature } from './_payfast.js'

async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  if (chunks.length) return Buffer.concat(chunks).toString('utf8')
  return ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('Method not allowed')
    return
  }

  const svc = createAdminClient()
  if (!svc) {
    console.error('[payfast-notify] server not configured')
    res.status(200).end('OK')
    return
  }

  const raw = await readRawBody(req)
  const params = new URLSearchParams(raw)
  let paymentId = params.get('custom_str2') || params.get('m_payment_id') || ''
  // m_payment_id may be hyphenless UUID from initiate; custom_str2 keeps canonical id.
  if (paymentId && !paymentId.includes('-') && paymentId.length === 32) {
    paymentId = `${paymentId.slice(0, 8)}-${paymentId.slice(8, 12)}-${paymentId.slice(12, 16)}-${paymentId.slice(16, 20)}-${paymentId.slice(20)}`
  }
  const paymentStatus = new URLSearchParams(raw).get('payment_status') ?? ''
  const pfPaymentId = new URLSearchParams(raw).get('pf_payment_id') ?? ''
  const amountGross = new URLSearchParams(raw).get('amount_gross') ?? ''

  if (!paymentId) {
    console.error('[payfast-notify] missing payment id')
    res.status(200).end('OK')
    return
  }

  const { data: payment } = await svc
    .from('subscription_payments')
    .select('id, user_id, amount_cents, status')
    .eq('id', paymentId)
    .maybeSingle()

  if (!payment) {
    console.error('[payfast-notify] payment not found', paymentId)
    res.status(200).end('OK')
    return
  }

  const { passphrase, validateHost } = resolvePayfastCredsFromEnv()
  const { ok: sigOk, expected, received } = verifyItnSignature(raw, passphrase)
  if (!sigOk) {
    console.error('[payfast-notify] signature mismatch', { expected, received })
    res.status(200).end('OK')
    return
  }

  if (amountGross && payfastAmount(payment.amount_cents) !== amountGross) {
    console.error('[payfast-notify] amount mismatch', {
      expected: payfastAmount(payment.amount_cents),
      got: amountGross,
    })
    res.status(200).end('OK')
    return
  }

  try {
    const verifyRes = await fetch(`${validateHost}/eng/query/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: raw,
    })
    const verifyText = (await verifyRes.text()).trim()
    if (!verifyText.toUpperCase().startsWith('VALID')) {
      console.error('[payfast-notify] PayFast validation failed:', verifyText)
      res.status(200).end('OK')
      return
    }
  } catch (e) {
    console.error('[payfast-notify] validation request error', e)
    res.status(200).end('OK')
    return
  }

  if (paymentStatus !== 'COMPLETE') {
    console.log('[payfast-notify] non-complete status:', paymentStatus)
    res.status(200).end('OK')
    return
  }

  const { error } = await svc.rpc('confirm_cuboards_subscription_payment', {
    p_payment_id: paymentId,
    p_pf_payment_id: pfPaymentId || null,
  })
  if (error) {
    console.error('[payfast-notify] confirm rpc error', error)
  } else {
    console.log('[payfast-notify] subscription activated for payment', paymentId)
  }

  res.status(200).end('OK')
}

export const config = {
  api: {
    bodyParser: false,
  },
}

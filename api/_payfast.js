import crypto from 'node:crypto'

export const PAYFAST_PROCESS = {
  live: 'https://www.payfast.co.za/eng/process',
  sandbox: 'https://sandbox.payfast.co.za/eng/process',
}

export const PAYFAST_SANDBOX_MERCHANT = {
  merchant_id: '10000100',
  merchant_key: '46f0cd694581a',
  passphrase: 'jt7NOE43FZPn',
}

export function resolvePayfastCredsFromEnv() {
  const sandbox = process.env.PAYFAST_SANDBOX !== 'false' && process.env.PAYFAST_SANDBOX !== '0'
  let merchantId = (process.env.PAYFAST_MERCHANT_ID ?? '').trim()
  let merchantKey = (process.env.PAYFAST_MERCHANT_KEY ?? '').trim()
  let passphrase = (process.env.PAYFAST_PASSPHRASE ?? '').trim() || undefined

  // Sandbox endpoint only accepts PayFast's universal test merchant (or your own
  // sandbox-linked merchant). Wrong live IDs in env vars cause HTTP 400 on /eng/process.
  const forceUniversalSandbox =
    sandbox && process.env.PAYFAST_USE_OWN_SANDBOX_MERCHANT !== 'true'
  if (forceUniversalSandbox || (sandbox && (!merchantId || !merchantKey))) {
    merchantId = PAYFAST_SANDBOX_MERCHANT.merchant_id
    merchantKey = PAYFAST_SANDBOX_MERCHANT.merchant_key
    passphrase = PAYFAST_SANDBOX_MERCHANT.passphrase
  }

  if (sandbox && merchantId === PAYFAST_SANDBOX_MERCHANT.merchant_id) {
    passphrase = PAYFAST_SANDBOX_MERCHANT.passphrase
  }

  return {
    sandbox,
    merchantId,
    merchantKey,
    passphrase,
    processUrl: sandbox ? PAYFAST_PROCESS.sandbox : PAYFAST_PROCESS.live,
    validateHost: sandbox ? 'https://sandbox.payfast.co.za' : 'https://www.payfast.co.za',
  }
}

export function pfEncode(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/%20/g, '+')
    .replace(/[!~*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

export function signFields(fields, passphrase) {
  let str = fields
    .filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
    .map(([k, v]) => `${k}=${pfEncode(String(v))}`)
    .join('&')
  if (passphrase && passphrase.trim() !== '') {
    str += `&passphrase=${pfEncode(passphrase)}`
  }
  return crypto.createHash('md5').update(str).digest('hex')
}

export function payfastAmount(cents) {
  return (Math.max(0, Math.round(cents)) / 100).toFixed(2)
}

export function verifyItnSignature(rawBody, passphrase) {
  const data = {}
  for (const part of rawBody.split('&')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const key = decodeURIComponent(part.slice(0, idx))
    const val = decodeURIComponent(part.slice(idx + 1).replace(/\+/g, ' '))
    data[key] = val
  }
  const received = (data.signature ?? '').toLowerCase()
  const rawParam = rawBody
    .split('&')
    .filter((p) => !p.startsWith('signature='))
    .join('&')
  const md5 = (s) => crypto.createHash('md5').update(s).digest('hex')
  const candidates = [md5(rawParam)]
  if (passphrase && passphrase.trim() !== '') {
    candidates.push(md5(`${rawParam}&passphrase=${pfEncode(passphrase)}`))
  }
  const ok = candidates.includes(received)
  const expected = candidates[candidates.length - 1]
  return { ok, data, expected, received }
}

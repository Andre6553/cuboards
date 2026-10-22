import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function getAppBaseUrl(req) {
  const envRaw = (process.env.APP_URL || process.env.VITE_APP_URL || '').trim()
  const env = envRaw.replace(/\/$/, '')
  const isLocalhost =
    env && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(env)

  // PayFast rejects localhost notify/return URLs — never use local APP_URL on Vercel.
  if (env && !(process.env.VERCEL && isLocalhost)) {
    return env
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`
  }
  const origin = req.headers.origin
  if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(origin)) {
    return origin.replace(/\/$/, '')
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'https'
  if (host) return `${proto}://${host}`.replace(/\/$/, '')
  return 'http://localhost:5199'
}

/** @param {import('http').IncomingMessage} req */
export async function getUserFromAuthHeader(req) {
  const admin = createAdminClient()
  if (!admin) return { error: 'Server not configured', user: null, admin: null }

  const raw = req.headers.authorization || ''
  const token = raw.replace(/^Bearer\s+/i, '').trim()
  if (!token) return { error: 'Missing authorization', user: null, admin }

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return { error: 'Invalid session', user: null, admin }
  return { error: null, user: data.user, admin }
}

/** Shared Vercel handler for Gelmar live-price scrapes (not a public route). */

/** @param {import('http').IncomingMessage} req @param {import('http').ServerResponse & { status: (n: number) => { json: (b: unknown) => void } }} res */
export async function handleGelmarScrape(req, res, scrapeFn) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  try {
    const result = await scrapeFn()
    res.status(200).json({
      ok: true,
      scrapedAt: result.scrapedAt,
      prices: result.prices,
      count: Object.keys(result.prices).length,
      warnings: result.warnings,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    res.status(502).json({ ok: false, error })
  }
}

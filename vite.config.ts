import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const GELMAR_API_ROUTES: Record<string, () => Promise<{ scrapedAt: string; prices: object; warnings?: string[] }>> = {
  '/api/gelmar-runners': () =>
    import('./scripts/gelmar-runners-lib.mjs').then((mod) => mod.scrapeGelmarRunners()),
  '/api/gelmar-hinges': () =>
    import('./scripts/gelmar-hinges-lib.mjs').then((mod) => mod.scrapeGelmarHinges()),
  '/api/gelmar-screws': () =>
    import('./scripts/gelmar-screws-lib.mjs').then((mod) => mod.scrapeGelmarScrews()),
  '/api/gelmar-connecting-fittings': () =>
    import('./scripts/gelmar-connecting-fittings-lib.mjs').then((mod) => mod.scrapeGelmarConnectingFittings()),
}

function gelmarPricesApi(): Plugin {
  const handle = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url?.split('?')[0]
    if (!url || !(url in GELMAR_API_ROUTES)) {
      next()
      return
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'Method not allowed' })
      return
    }

    void GELMAR_API_ROUTES[url]()
      .then((result) => {
        json(res, 200, {
          ok: true,
          scrapedAt: result.scrapedAt,
          prices: result.prices as Record<string, number>,
          count: Object.keys(result.prices).length,
          warnings: result.warnings,
        })
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err.message : String(err)
        json(res, 502, { ok: false, error })
      })
  }

  return {
    name: 'gelmar-prices-api',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), gelmarPricesApi()],
  server: {
    port: 5199,
    strictPort: true,
  },
  preview: {
    port: 5199,
    strictPort: true,
  },
})

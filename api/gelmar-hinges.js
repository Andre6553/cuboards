import { handleGelmarScrape } from './_gelmar.js'
import { scrapeGelmarHinges } from '../scripts/gelmar-hinges-lib.mjs'

export default function handler(req, res) {
  return handleGelmarScrape(req, res, () => scrapeGelmarHinges())
}

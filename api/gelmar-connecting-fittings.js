import { handleGelmarScrape } from './_gelmar.js'
import { scrapeGelmarConnectingFittings } from '../scripts/gelmar-connecting-fittings-lib.mjs'

export default function handler(req, res) {
  return handleGelmarScrape(req, res, () => scrapeGelmarConnectingFittings())
}

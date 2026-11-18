import { handleGelmarScrape } from './_gelmar.js'
import { scrapeGelmarPlinthCorner } from '../scripts/gelmar-plinth-corner-lib.mjs'

export default function handler(req, res) {
  return handleGelmarScrape(req, res, () => scrapeGelmarPlinthCorner(req.url))
}

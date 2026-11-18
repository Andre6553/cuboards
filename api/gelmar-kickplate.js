import { handleGelmarScrape } from './_gelmar.js'
import { scrapeGelmarKickplate } from '../scripts/gelmar-kickplate-lib.mjs'

export default function handler(req, res) {
  return handleGelmarScrape(req, res, () => scrapeGelmarKickplate(req.url))
}

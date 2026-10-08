import { handleGelmarScrape } from './_gelmar.js'
import { scrapeGelmarRunners } from '../scripts/gelmar-runners-lib.mjs'

export default function handler(req, res) {
  return handleGelmarScrape(req, res, () => scrapeGelmarRunners())
}

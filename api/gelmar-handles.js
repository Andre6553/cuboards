import { handleGelmarScrape } from './_gelmar.js'
import { scrapeGelmarHandles } from '../scripts/gelmar-handles-lib.mjs'

export default function handler(req, res) {
  return handleGelmarScrape(req, res, () => scrapeGelmarHandles())
}

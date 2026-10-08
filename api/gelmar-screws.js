import { handleGelmarScrape } from './_gelmar.js'
import { scrapeGelmarScrews } from '../scripts/gelmar-screws-lib.mjs'

export default function handler(req, res) {
  return handleGelmarScrape(req, res, () => scrapeGelmarScrews())
}

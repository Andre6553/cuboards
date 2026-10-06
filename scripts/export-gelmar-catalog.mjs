/** Fetch all Gelmar runner categories and write src/data/gelmarRunners.json */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { scrapeGelmarRunners } from './gelmar-runners-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '../src/data/gelmarRunners.json');

const result = await scrapeGelmarRunners();
writeFileSync(
  outPath,
  JSON.stringify({ scrapedAt: result.scrapedAt, runners: result.runners }, null, 2),
);
console.log(`Wrote ${result.runners.length} runners to ${outPath}`);
if (result.warnings.length) {
  console.warn('Warnings:', result.warnings.join('\n'));
}

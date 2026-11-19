/** Fetch Gelmar handles (pages 1–31) and write src/data/gelmarHandles.json */
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { scrapeGelmarHandles } from './gelmar-handles-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '../src/data/gelmarHandles.json');

const result = await scrapeGelmarHandles();
if (result.warnings?.length) {
  console.warn('Warnings:', result.warnings.join('\n'));
}

writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      scrapedAt: result.scrapedAt,
      handles: result.handles,
    },
    null,
    2,
  )}\n`,
);
console.log(`Wrote ${result.handles.length} handles (${Object.keys(result.prices).length} priced) to ${outPath}`);

const url = process.argv[2] ?? 'https://www.gelmar.co.za/runners.html?cat=98_roller-runners';

function decodeHtml(s) {
  return s
    .replace(/&#x20;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

const res = await fetch(url);
const html = await res.text();
const all = [];
const blockRe = /class="product-item-info"[\s\S]*?(?=class="product-item-info"|$)/g;
let block;
while ((block = blockRe.exec(html))) {
  const chunk = block[0];
  const alt = chunk.match(/alt="([^"]+)"/)?.[1];
  const title = decodeHtml(alt ?? '');
  const sku = chunk.match(/SKU[^0-9]*(\d{4})/)?.[1];
  const price =
    chunk.match(/data-price-amount="([\d.]+)"/)?.[1] ??
    chunk.match(/ZAR\s*([\d.]+)/)?.[1];
  const href = chunk.match(/href="(https:\/\/www\.gelmar\.co\.za\/[^"]+)"/)?.[1];
  if (!title || title.includes('Ombud')) continue;

  const lengthMm =
    title.match(/,\s*(\d+)mm,/)?.[1] ??
    title.match(/,\s*(\d+)mm\b/)?.[1];
  const capacityKg = title.match(/(\d+)kg\s*Capacity/i)?.[1];
  const colour = title.match(/\b(White|Black)\b/i)?.[1];
  const sideHeightMm = title.match(/H(\d+),/i)?.[1];

  all.push({
    title,
    sku,
    type: title.startsWith('Metal Drawer Side') ? 'metal_drawer_side' : 'roller_runner',
    lengthMm: lengthMm ? Number(lengthMm) : null,
    sideHeightMm: sideHeightMm ? Number(sideHeightMm) : null,
    colour: colour ? colour[0].toUpperCase() + colour.slice(1).toLowerCase() : null,
    capacityKg: capacityKg ? Number(capacityKg) : null,
    priceZar: price ? parseFloat(price) : null,
    url: href,
  });
}

const rollers = all.filter((x) => x.type === 'roller_runner');
const sides = all.filter((x) => x.type === 'metal_drawer_side');
console.log(JSON.stringify({ rollerRunners: rollers, metalDrawerSides: sides }, null, 2));
console.error(`\nRoller runners: ${rollers.length} | Metal drawer sides: ${sides.length}`);

const res = await fetch('https://www.gelmar.co.za/runners.html?cat=213_soft-close-runners');
const html = await res.text();
const blocks = [...html.matchAll(/class="product-item-info"[\s\S]*?(?=class="product-item-info"|$)/g)].map((m) => m[0]);
for (const chunk of blocks) {
  const alt = chunk.match(/alt="([^"]+)"/)?.[1]?.replace(/&#x20;/g, ' ');
  const sku = chunk.match(/SKU[^0-9]*(\d{4})/)?.[1];
  console.log(sku, alt?.slice(0, 60));
}

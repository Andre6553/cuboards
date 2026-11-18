/** Gelmar white PVC plinth strips (3 m) used for plastic kickplates. */
export const GELMAR_KICKPLATE_PRODUCTS = {
  100: {
    heightMm: 100,
    sku: '6801',
    name: 'Plinth, White, 100mm x 3m',
    url: 'https://www.gelmar.co.za/plinth-white-100mm-x-3m.html',
    imageUrl: 'https://www.gelmar.co.za/media/catalog/product/6/8/6801_1.jpg',
  },
  150: {
    heightMm: 150,
    sku: '6800',
    name: 'Plinth, White, 150mm x 3m',
    url: 'https://www.gelmar.co.za/plinth-white-150mm-x-3m.html',
    imageUrl: 'https://www.gelmar.co.za/media/catalog/product/6/8/6800_1.jpg',
  },
} as const;

/** Flexible aluminium plinth corners matched to plastic kickplate height. */
export const GELMAR_PLINTH_CORNER_PRODUCTS = {
  100: {
    heightMm: 100,
    sku: '6066',
    name: 'Plinth Corner, Flexible, Aluminium, 100mm',
    url: 'https://www.gelmar.co.za/plinth-corner-flexible-aluminium-100mm.html',
    imageUrl: 'https://www.gelmar.co.za/media/catalog/product/6/0/6066.jpg',
    defaultPriceEach: 8,
  },
  150: {
    heightMm: 150,
    sku: '6795',
    name: 'Plinth Corner, Flexible, Aluminium, 150mm',
    url: 'https://www.gelmar.co.za/plinth-corner-flexible-aluminium-150mm.html',
    imageUrl: 'https://www.gelmar.co.za/media/catalog/product/6/7/6795_1.jpg',
    defaultPriceEach: 11,
  },
} as const;

export type GelmarKickplateHeight = keyof typeof GELMAR_KICKPLATE_PRODUCTS;
export type GelmarPlinthCornerHeight = keyof typeof GELMAR_PLINTH_CORNER_PRODUCTS;

export function gelmarKickplateProduct(heightMm: number) {
  if (heightMm === 100 || heightMm === 150) return GELMAR_KICKPLATE_PRODUCTS[heightMm];
  return null;
}

export function gelmarPlinthCornerProduct(heightMm: number) {
  if (heightMm === 100 || heightMm === 150) return GELMAR_PLINTH_CORNER_PRODUCTS[heightMm];
  if (!Number.isFinite(heightMm)) return GELMAR_PLINTH_CORNER_PRODUCTS[100];
  const h = Math.abs(heightMm - 150) < Math.abs(heightMm - 100) ? 150 : 100;
  return GELMAR_PLINTH_CORNER_PRODUCTS[h];
}

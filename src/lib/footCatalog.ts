/** Gelmar adjustable kitchen leg — quoted per foot on floor units (plinth). */
export const GELMAR_CABINET_FOOT = {
  id: 'gelmar-kitchen-leg-h98-122',
  name: 'Kitchen Leg, Adjustable, H98mm - 122mm, 4 Pieces with Clips',
  shortName: 'Gelmar adjustable kitchen leg H98–122 mm (with clips)',
  sku: '3294',
  url: 'https://www.gelmar.co.za/kitchen-leg-adjustable-h98mm-122mm-4-pieces-with-clips.html',
  imageUrl: 'https://www.gelmar.co.za/media/catalog/product/3/2/3294_1.jpg',
  /** Gelmar online list price per 4-pack (Mar 2026) — quotes use job “price per foot”. */
  gelmarPackOf4ListPrice: 20,
} as const;

export function cabinetFootHardwareDescription(): string {
  return 'Cabinet adjustable foot';
}

export function cabinetFootHardwareDetail(feetPerCupboard: number): string {
  const { shortName, sku } = GELMAR_CABINET_FOOT;
  return `${shortName} · SKU ${sku} · H98–122 mm · ${feetPerCupboard}/cupboard`;
}
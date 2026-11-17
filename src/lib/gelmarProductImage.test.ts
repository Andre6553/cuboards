import { describe, expect, it } from 'vitest';
import {
  gelmarCatalogSearchUrl,
  gelmarProductImageCandidates,
  isLikelyGelmarPlaceholderImage,
} from './gelmarProductImage';

describe('gelmarProductImageCandidates', () => {
  it('prefers catalog imageUrl then cache pack photo for the SKU', () => {
    const preferred = 'https://www.gelmar.co.za/media/catalog/product/4/3/4372.jpg';
    const urls = gelmarProductImageCandidates('4372', preferred);
    expect(urls[0]).toBe(preferred);
    expect(urls).toContain(
      'https://www.gelmar.co.za/media/catalog/product/cache/c6dd74c09890d08f52e9961c334b9e7b/4/3/4372.jpg',
    );
  });

  it('builds a Gelmar catalog search URL from the SKU', () => {
    expect(gelmarCatalogSearchUrl('5053')).toBe('https://www.gelmar.co.za/catalogsearch/result/?q=5053');
  });

  it('treats Magento logo-sized images as placeholders', () => {
    expect(isLikelyGelmarPlaceholderImage(110, 110)).toBe(true);
    expect(isLikelyGelmarPlaceholderImage(265, 265)).toBe(true);
    expect(isLikelyGelmarPlaceholderImage(600, 600)).toBe(false);
  });
});
import { useMemo, useState } from 'react';
import {
  gelmarCatalogSearchUrl,
  gelmarProductImageCandidates,
  isLikelyGelmarPlaceholderImage,
} from '../lib/gelmarProductImage';

interface Props {
  sku: string;
  imageUrl?: string;
  alt: string;
  productUrl?: string;
}

export function HardwareProductThumb({ sku, imageUrl, alt, productUrl }: Props) {
  const candidates = useMemo(
    () => gelmarProductImageCandidates(sku, imageUrl),
    [sku, imageUrl],
  );
  const [index, setIndex] = useState(0);
  const searchUrl = gelmarCatalogSearchUrl(sku);
  const hasPicture = index < candidates.length;

  if (!hasPicture) {
    if (!searchUrl && !productUrl) {
      return <span className="hw-shop-thumb hw-shop-thumb--empty" aria-hidden />;
    }
    return (
      <a
        className="hw-shop-thumb hw-shop-thumb--empty hw-shop-thumb-link"
        href={searchUrl || productUrl}
        target="_blank"
        rel="noreferrer"
        title={`Find SKU ${sku} on Gelmar`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="hw-shop-thumb-search">Gelmar</span>
      </a>
    );
  }

  const img = (
    <img
      className="hw-shop-thumb"
      src={candidates[index]}
      alt={alt}
      loading="lazy"
      onLoad={(e) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        if (isLikelyGelmarPlaceholderImage(naturalWidth, naturalHeight)) {
          setIndex((i) => i + 1);
        }
      }}
      onError={() => setIndex((i) => i + 1)}
    />
  );

  if (!productUrl) return img;
  return (
    <a
      className="hw-shop-thumb-link"
      href={productUrl}
      target="_blank"
      rel="noreferrer"
      title={alt}
      onClick={(e) => e.stopPropagation()}
    >
      {img}
    </a>
  );
}
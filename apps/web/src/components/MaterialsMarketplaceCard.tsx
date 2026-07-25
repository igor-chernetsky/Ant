'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import type { MaterialsMarketplace } from '@/lib/materials-marketplaces';

interface MaterialsMarketplaceCardProps {
  platform: MaterialsMarketplace;
}

export function MaterialsMarketplaceCard({
  platform,
}: MaterialsMarketplaceCardProps) {
  const { t } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const previewSrc = `/api/materials/${encodeURIComponent(platform.id)}/preview`;

  return (
    <a
      href={platform.url}
      target="_blank"
      rel="noopener noreferrer"
      className="materials-store-card"
    >
      <div className="materials-store-card-header">
        <div className="materials-store-icon" aria-hidden>
          {!imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt=""
              className="materials-store-icon-image"
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="materials-store-icon-fallback">
              {platform.name.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="materials-store-heading">
          <div className="materials-store-title-row">
            <h2 className="materials-store-title">{platform.name}</h2>
            <span className="materials-store-external">
              {t('materials.external')}
            </span>
          </div>
          <p className="materials-store-visit muted">
            {t('materials.visit')} →
          </p>
        </div>
      </div>
      <p className="materials-store-description">
        {t(`materials.blurbs.${platform.blurbKey}`)}
      </p>
      <div className="materials-store-tags">
        {platform.categories.slice(0, 4).map((tag) => (
          <span key={tag} className="tag-pill">
            {t(`materials.categories.${tag}`)}
          </span>
        ))}
      </div>
    </a>
  );
}

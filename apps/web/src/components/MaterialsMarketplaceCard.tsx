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
      className="project-tile materials-tile"
    >
      <div className="project-tile-media materials-tile-media">
        {!imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt=""
            className="project-tile-image materials-tile-image"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="project-tile-placeholder" aria-hidden>
            <span>{platform.name.slice(0, 1)}</span>
          </div>
        )}
        <span className="project-tile-status">{t('materials.external')}</span>
      </div>
      <div className="project-tile-body">
        <h2 className="project-tile-title">{platform.name}</h2>
        <p className="project-tile-description">
          {t(`materials.blurbs.${platform.blurbKey}`)}
        </p>
        <div className="project-tile-tags">
          {platform.categories.slice(0, 4).map((tag) => (
            <span key={tag} className="tag-pill">
              {t(`materials.categories.${tag}`)}
            </span>
          ))}
        </div>
        <p className="materials-tile-visit muted">{t('materials.visit')} →</p>
      </div>
    </a>
  );
}

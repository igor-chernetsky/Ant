'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { fetchPublicPortfolio, type PortfolioItem } from '@/lib/portfolio';

interface ContractorPortfolioGalleryProps {
  contractorId: string;
  companyName?: string | null;
}

export function ContractorPortfolioGallery({
  contractorId,
  companyName,
}: ContractorPortfolioGalleryProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchPublicPortfolio(contractorId)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contractorId]);

  if (loading || items.length === 0) {
    return null;
  }

  return (
    <details className="contractor-portfolio-preview">
      <summary className="contractor-portfolio-preview-summary">
        {t('portfolio.gallerySummary', { count: items.length })}
        {companyName ? ` · ${companyName}` : ''}
      </summary>
      <ul className="contractor-portfolio-preview-grid">
        {items.map((item) => (
          <li key={item.id} className="contractor-portfolio-preview-item">
            <a
              href={item.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="contractor-portfolio-thumb-link"
            >
              {item.thumbnailUrl || item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnailUrl ?? item.imageUrl}
                  alt={item.title}
                  className="contractor-portfolio-thumb"
                  loading="lazy"
                />
              ) : null}
            </a>
            {item.title?.trim() ? (
              <p className="contractor-portfolio-preview-title">{item.title}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

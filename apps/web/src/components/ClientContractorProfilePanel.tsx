'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import {
  fetchBidContractorDocumentDownload,
  fetchBidContractorProfile,
  type BidContractorProfileView,
} from '@/lib/tendering';

interface ClientContractorProfilePanelProps {
  projectId: string;
  bidId: string;
  companyName?: string | null;
}

export function ClientContractorProfilePanel({
  projectId,
  bidId,
  companyName,
}: ClientContractorProfilePanelProps) {
  const { t } = useTranslation();
  const { formatDocumentCategory, formatVerificationStatus } =
    useAppFormatters();
  const [profile, setProfile] = useState<BidContractorProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchBidContractorProfile(projectId, bidId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setProfile(null);
          setError(
            err instanceof Error
              ? err.message
              : t('bidContractorProfile.loadFailed'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, bidId, t]);

  async function handleDownload(documentId: string) {
    setDownloadingId(documentId);
    try {
      const result = await fetchBidContractorDocumentDownload(
        projectId,
        bidId,
        documentId,
      );
      window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('bidContractorProfile.downloadFailed'),
      );
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return (
      <p className="muted bid-contractor-profile-loading">
        {t('bidContractorProfile.loading')}
      </p>
    );
  }

  if (error && !profile) {
    return <p className="form-error">{error}</p>;
  }

  if (!profile) {
    return null;
  }

  const photoCount = profile.portfolio.length;
  const docCount = profile.documents.length;
  const displayName =
    profile.companyName?.trim() ||
    companyName?.trim() ||
    t('common.contractor');

  return (
    <details className="contractor-portfolio-preview bid-contractor-profile">
      <summary className="contractor-portfolio-preview-summary">
        {t('bidContractorProfile.summary', {
          photos: String(photoCount),
          docs: String(docCount),
        })}
        {` · ${displayName}`}
      </summary>

      <div className="bid-contractor-profile-body">
        <div className="bid-contractor-profile-meta muted">
          <span>
            {t('bidContractorProfile.verification')}:{' '}
            {formatVerificationStatus(profile.verificationStatus)}
          </span>
          {profile.tagSlugs.length > 0 && (
            <span>
              {t('bidContractorProfile.specialties')}:{' '}
              {profile.tagSlugs.join(', ')}
            </span>
          )}
        </div>

        <h3 className="bid-contractor-profile-heading">
          {t('bidContractorProfile.portfolioHeading')}
        </h3>
        {photoCount === 0 ? (
          <p className="muted">{t('bidContractorProfile.noPortfolio')}</p>
        ) : (
          <ul className="contractor-portfolio-preview-grid">
            {profile.portfolio.map((item) => (
              <li key={item.id} className="contractor-portfolio-preview-item">
                {item.thumbnailUrl || item.imageUrl ? (
                  <a
                    href={item.imageUrl ?? item.thumbnailUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="contractor-portfolio-thumb-link"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbnailUrl ?? item.imageUrl ?? undefined}
                      alt={item.title?.trim() || t('portfolio.photoAlt')}
                      className="contractor-portfolio-thumb"
                      loading="lazy"
                    />
                  </a>
                ) : null}
                {item.title?.trim() ? (
                  <p className="contractor-portfolio-preview-title">
                    {item.title}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <h3 className="bid-contractor-profile-heading">
          {t('bidContractorProfile.documentsHeading')}
        </h3>
        {docCount === 0 ? (
          <p className="muted">{t('bidContractorProfile.noDocuments')}</p>
        ) : (
          <ul className="bid-contractor-profile-docs">
            {profile.documents.map((doc) => (
              <li key={doc.id} className="bid-contractor-profile-doc">
                <div className="bid-contractor-profile-doc-info">
                  <strong>{doc.originalName}</strong>
                  <span className="muted">
                    {formatDocumentCategory(doc.category)}
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary"
                  disabled={downloadingId === doc.id}
                  onClick={() => void handleDownload(doc.id)}
                >
                  {downloadingId === doc.id
                    ? t('common.loading')
                    : t('bidContractorProfile.download')}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </details>
  );
}

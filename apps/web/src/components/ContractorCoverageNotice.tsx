'use client';

import { useEffect, useState } from 'react';
import {
  fetchContractorCoverage,
  type ContractorCoveragePreview,
} from '@/lib/tendering';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';

interface ContractorCoverageNoticeProps {
  projectId: string;
  enabled: boolean;
  tagKey?: string;
  /** Design & Permits projects address designers, not contractors. */
  audience?: 'contractor' | 'designer';
}

function formatTagList(
  tags: ContractorCoveragePreview['projectTags'],
  formatTagLabel: (slug: string, fallback?: string | null) => string,
): string {
  return tags.map((tag) => formatTagLabel(tag.slug, tag.label)).join(', ');
}

export function ContractorCoverageNotice({
  projectId,
  enabled,
  tagKey = '',
  audience = 'contractor',
}: ContractorCoverageNoticeProps) {
  const { t } = useTranslation();
  const { formatTagLabel } = useAppFormatters();
  const [coverage, setCoverage] = useState<ContractorCoveragePreview | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDesign = audience === 'designer';

  useEffect(() => {
    if (!enabled) {
      setCoverage(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchContractorCoverage(projectId)
      .then((data) => {
        if (!cancelled) {
          setCoverage(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : t(isDesign ? 'coverage.loadFailedDesign' : 'coverage.loadFailed'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, projectId, tagKey, t, isDesign]);

  if (!enabled) {
    return null;
  }

  if (loading) {
    return (
      <p className="muted contractor-coverage-notice contractor-coverage-loading">
        {t(isDesign ? 'coverage.loadingDesign' : 'coverage.loading')}
      </p>
    );
  }

  if (error || !coverage) {
    return null;
  }

  const tagList = formatTagList(coverage.projectTags, formatTagLabel);
  const professionalLabel =
    coverage.contractorCount === 1
      ? t(isDesign ? 'coverage.designer_one' : 'coverage.contractor_one')
      : t(isDesign ? 'coverage.designer_other' : 'coverage.contractor_other');

  if (coverage.suggestSplitProject) {
    return (
      <div
        className="contractor-coverage-notice contractor-coverage-notice-warning"
        role="note"
      >
        <p className="contractor-coverage-notice-title">
          {t('coverage.noCoverageTitle', { location: coverage.locationLabel })}
        </p>
        <p className="contractor-coverage-notice-text">
          {t(
            isDesign ? 'coverage.noCoverageTextDesign' : 'coverage.noCoverageText',
            {
              count: coverage.projectTags.length,
              tags: tagList ? ` (${tagList})` : '',
            },
          )}
        </p>
      </div>
    );
  }

  if (coverage.projectTags.length === 0) {
    return (
      <div className="contractor-coverage-notice" role="note">
        <p className="contractor-coverage-notice-text">
          {t('coverage.locationMatch', {
            count: coverage.contractorCount,
            contractors: professionalLabel,
            location: coverage.locationLabel,
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="contractor-coverage-notice" role="note">
      <p className="contractor-coverage-notice-text">
        {t('coverage.coversAll', {
          count: coverage.contractorCount,
          contractors: professionalLabel,
          location: coverage.locationLabel,
          verb:
            coverage.contractorCount === 1
              ? t('coverage.covers')
              : t('coverage.cover'),
          tags: tagList ? `: ${tagList}` : '',
        })}
      </p>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import {
  fetchContractorCoverage,
  type ContractorCoveragePreview,
} from '@/lib/tendering';
import { useTranslation } from '@/components/LocaleProvider';

interface ContractorCoverageNoticeProps {
  projectId: string;
  enabled: boolean;
  tagKey?: string;
}

function formatTagList(tags: ContractorCoveragePreview['projectTags']): string {
  return tags.map((tag) => tag.label).join(', ');
}

export function ContractorCoverageNotice({
  projectId,
  enabled,
  tagKey = '',
}: ContractorCoverageNoticeProps) {
  const { t } = useTranslation();
  const [coverage, setCoverage] = useState<ContractorCoveragePreview | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              : t('coverage.loadFailed'),
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
  }, [enabled, projectId, tagKey, t]);

  if (!enabled) {
    return null;
  }

  if (loading) {
    return (
      <p className="muted contractor-coverage-notice contractor-coverage-loading">
        {t('coverage.loading')}
      </p>
    );
  }

  if (error || !coverage) {
    return null;
  }

  const tagList = formatTagList(coverage.projectTags);
  const contractorLabel =
    coverage.contractorCount === 1
      ? t('coverage.contractor_one')
      : t('coverage.contractor_other');

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
          {t('coverage.noCoverageText', {
            count: coverage.projectTags.length,
            tags: tagList ? ` (${tagList})` : '',
          })}
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
            contractors: contractorLabel,
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
          contractors: contractorLabel,
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

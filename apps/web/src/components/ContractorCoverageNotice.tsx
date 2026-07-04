'use client';

import { useEffect, useState } from 'react';
import {
  fetchContractorCoverage,
  type ContractorCoveragePreview,
} from '@/lib/tendering';

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
              : 'Failed to load contractor availability',
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
  }, [enabled, projectId, tagKey]);

  if (!enabled) {
    return null;
  }

  if (loading) {
    return (
      <p className="muted contractor-coverage-notice contractor-coverage-loading">
        Checking contractor availability in your area…
      </p>
    );
  }

  if (error || !coverage) {
    return null;
  }

  const tagList = formatTagList(coverage.projectTags);
  const contractorLabel =
    coverage.contractorCount === 1 ? 'contractor' : 'contractors';

  if (coverage.suggestSplitProject) {
    return (
      <div
        className="contractor-coverage-notice contractor-coverage-notice-warning"
        role="note"
      >
        <p className="contractor-coverage-notice-title">
          No full-trade coverage in {coverage.locationLabel}
        </p>
        <p className="contractor-coverage-notice-text">
          No contractors in this area list all {coverage.projectTags.length}{' '}
          trades at once
          {tagList ? ` (${tagList})` : ''}. Consider splitting this into
          smaller projects — for example, one tender per trade — so specialists
          can bid on each scope.
        </p>
      </div>
    );
  }

  if (coverage.projectTags.length === 0) {
    return (
      <div className="contractor-coverage-notice" role="note">
        <p className="contractor-coverage-notice-text">
          <strong>{coverage.contractorCount}</strong> {contractorLabel} in{' '}
          {coverage.locationLabel} match this location. Add trade tags to see
          how many cover all listed work types.
        </p>
      </div>
    );
  }

  return (
    <div className="contractor-coverage-notice" role="note">
      <p className="contractor-coverage-notice-text">
        <strong>{coverage.contractorCount}</strong> {contractorLabel} in{' '}
        {coverage.locationLabel}{' '}
        {coverage.contractorCount === 1 ? 'covers' : 'cover'} all listed trades
        {tagList ? `: ${tagList}` : ''}.
      </p>
    </div>
  );
}

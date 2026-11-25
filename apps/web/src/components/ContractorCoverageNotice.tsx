'use client';

import { useEffect, useState } from 'react';
import {
  fetchContractorCoverage,
  type ContractorCoveragePreview,
} from '@/lib/tendering';
import { useTranslation } from '@/components/LocaleProvider';
import { resolveCoverageInvite } from '@/lib/coverage-invite-state';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { DIRECTORY_INVITE_LOW_MATCH_THRESHOLD, DIRECTORY_INVITE_HIDE_TRADE_LIST_THRESHOLD } from '@/lib/directory-invite-suggest';

interface ContractorCoverageNoticeProps {
  projectId: string;
  enabled: boolean;
  tagKey?: string;
  /** Bump to refetch coverage (e.g. after registry invites). */
  refreshKey?: number;
  /** Design & Permits projects address designers, not contractors. */
  audience?: 'contractor' | 'designer';
  /** Always show registry invite CTA (clarification / tender start). */
  alwaysSuggestInvite?: boolean;
  onInviteFromDirectory?: () => void;
  /**
   * Set when the invite action exists but the project cannot send one yet (for
   * example the tender has not been published). The button stays visible but
   * disabled, with the reason as its hint — better than a visible button that
   * fails with "Invites are only available during tender publication".
   */
  inviteDisabledReason?: string;
  onCoverageLoaded?: (coverage: ContractorCoveragePreview | null) => void;
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
  refreshKey = 0,
  audience = 'contractor',
  alwaysSuggestInvite = false,
  onInviteFromDirectory,
  inviteDisabledReason,
  onCoverageLoaded,
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
      onCoverageLoaded?.(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchContractorCoverage(projectId)
      .then((data) => {
        if (!cancelled) {
          setCoverage(data);
          onCoverageLoaded?.(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : t(isDesign ? 'coverage.loadFailedDesign' : 'coverage.loadFailed'),
          );
          onCoverageLoaded?.(null);
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
  }, [enabled, projectId, tagKey, refreshKey, t, isDesign, onCoverageLoaded]);

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
  const professionalPlural = t(
    isDesign ? 'coverage.designer_other' : 'coverage.contractor_other',
  );
  const lowMatchInvite =
    coverage.suggestInviteFromDirectory === true ||
    coverage.contractorCount <= DIRECTORY_INVITE_LOW_MATCH_THRESHOLD;
  /**
   * The handler is present whenever an invite is possible *in principle*; the API
   * only accepts it while the tender is open or in clarification, so a reason turns
   * the button into a disabled, self-explaining one instead of a failing action.
   */
  const invite = resolveCoverageInvite({
    hasHandler: Boolean(onInviteFromDirectory),
    alwaysSuggestInvite,
    isDesign,
    lowMatchInvite,
    disabledReason: inviteDisabledReason,
  });
  const showInvite = invite.visible;
  const showTradeList =
    coverage.projectTags.length > 0 &&
    coverage.contractorCount < DIRECTORY_INVITE_HIDE_TRADE_LIST_THRESHOLD;

  const inviteBlock = showInvite ? (
    <div className="contractor-coverage-invite">
      <p className="contractor-coverage-notice-text">
        {lowMatchInvite
          ? t('coverage.inviteSuggestLowMatches', {
              count: coverage.contractorCount,
              professionals: professionalPlural,
            })
          : isDesign
            ? t('coverage.inviteAnytimeDesign')
            : t('coverage.inviteAnytimeContractors')}
      </p>
      <button
        type="button"
        className="secondary"
        disabled={!invite.enabled}
        title={inviteDisabledReason}
        onClick={() => onInviteFromDirectory?.()}
      >
        {t('tenderCard.inviteFromDirectory')}
      </button>
      {invite.hint ? (
        <p className="muted contractor-coverage-invite-hint">{invite.hint}</p>
      ) : null}
    </div>
  ) : null;

  if (coverage.contractorCount === 0 && coverage.projectTags.length > 0) {
    return (
      <div
        className="contractor-coverage-notice contractor-coverage-notice-warning"
        role="note"
      >
        <p className="contractor-coverage-notice-title">
          {t(
            isDesign ? 'coverage.noCoverageTextDesign' : 'coverage.noCoverageTitle',
          )}
        </p>
        {coverage.suggestSplitProject ? (
          <p className="contractor-coverage-notice-text">
            {t('coverage.noCoverageText')}
          </p>
        ) : null}
        {inviteBlock}
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
        {inviteBlock}
      </div>
    );
  }

  return (
    <div
      className={`contractor-coverage-notice${
        lowMatchInvite ? ' contractor-coverage-notice-warning' : ''
      }`}
      role="note"
    >
      <p className="contractor-coverage-notice-text">
        {t('coverage.coversAll', {
          count: coverage.contractorCount,
          contractors: professionalLabel,
          location: coverage.locationLabel,
          verb:
            coverage.contractorCount === 1
              ? t('coverage.covers')
              : t('coverage.cover'),
          tags: showTradeList && tagList ? `: ${tagList}` : '',
        })}
      </p>
      {inviteBlock}
    </div>
  );
}

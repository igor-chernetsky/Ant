'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { formatThb } from '@/lib/estimate';
import { bidWorksSubtotalForCompare } from '@/lib/bid-cost-adjustments';
import type { Bid, BidLineItem, DefaultCostBreakdownItem } from '@/lib/tendering';

interface BidsCompareTableProps {
  bids: Bid[];
  ballparkMid?: number | null;
  defaultCostBreakdown?: DefaultCostBreakdownItem[];
}

function formatCompareDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) {
    const date = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
    );
    return date.toLocaleDateString();
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toLocaleDateString();
}

function normalizeTrade(value: string): string {
  return value.trim().toLowerCase();
}

function amountForTrade(bid: Bid, trade: string): number | null {
  const key = normalizeTrade(trade);
  const item = bid.terms?.lineItems?.find(
    (line) => normalizeTrade(line.trade) === key,
  );
  if (!item || item.amount == null) {
    return null;
  }
  const amount = Number(item.amount);
  return Number.isFinite(amount) ? amount : null;
}

function breakdownSubtotal(items?: BidLineItem[]): number | null {
  if (!items?.length) {
    return null;
  }
  const total = items.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
  return total > 0 ? total : null;
}

function contractorProposalCount(bid: Bid): number {
  return bid.contractorProposalCount ?? 1;
}

function isUpdatedProposal(bid: Bid): boolean {
  return contractorProposalCount(bid) > 1;
}

function formatBallparkDelta(
  worksAmount: number,
  ballparkMid: number | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!ballparkMid || ballparkMid <= 0) {
    return t('common.dash');
  }
  const delta = Math.round(((worksAmount - ballparkMid) / ballparkMid) * 100);
  return t('bidApplication.vsBallpark', {
    delta: `${delta >= 0 ? '+' : ''}${delta}`,
  });
}

/** Indices of the lowest finite amount(s); empty when nothing comparable. */
function lowestAmountIndices(amounts: Array<number | null>): Set<number> {
  let min: number | null = null;
  for (const amount of amounts) {
    if (amount == null || !Number.isFinite(amount)) continue;
    if (min == null || amount < min) {
      min = amount;
    }
  }
  if (min == null) {
    return new Set();
  }
  const indices = new Set<number>();
  amounts.forEach((amount, index) => {
    if (amount != null && Number.isFinite(amount) && amount === min) {
      indices.add(index);
    }
  });
  return indices;
}

function syncCompareRowHeights(
  metricsTable: HTMLTableElement | null,
  bidsTable: HTMLTableElement | null,
) {
  if (!metricsTable || !bidsTable) return;

  const leftRows = Array.from(metricsTable.querySelectorAll('tr'));
  const rightRows = Array.from(bidsTable.querySelectorAll('tr'));
  const count = Math.min(leftRows.length, rightRows.length);

  for (let i = 0; i < count; i += 1) {
    leftRows[i].style.height = '';
    rightRows[i].style.height = '';
  }

  for (let i = 0; i < count; i += 1) {
    const height = Math.max(
      leftRows[i].getBoundingClientRect().height,
      rightRows[i].getBoundingClientRect().height,
    );
    leftRows[i].style.height = `${height}px`;
    rightRows[i].style.height = `${height}px`;
  }
}

export function BidsCompareTable({
  bids,
  ballparkMid,
  defaultCostBreakdown = [],
}: BidsCompareTableProps) {
  const { t } = useTranslation();
  const metricsTableRef = useRef<HTMLTableElement>(null);
  const bidsTableRef = useRef<HTMLTableElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    bids.map((bid) => bid.id),
  );

  const selectedBids = useMemo(
    () => bids.filter((bid) => selectedIds.includes(bid.id)),
    [bids, selectedIds],
  );

  const breakdownRows = useMemo(() => {
    const seen = new Set<string>();
    const merged: DefaultCostBreakdownItem[] = [];

    const addRow = (item: DefaultCostBreakdownItem | BidLineItem) => {
      const trade = item.trade?.trim();
      if (!trade) {
        return;
      }
      const key = normalizeTrade(trade);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      merged.push({
        trade,
        description: item.description?.trim() || undefined,
      });
    };

    for (const item of defaultCostBreakdown) {
      addRow(item);
    }

    for (const bid of selectedBids) {
      for (const item of bid.terms?.lineItems ?? []) {
        addRow(item);
      }
    }

    return merged;
  }, [defaultCostBreakdown, selectedBids]);

  const lowestByTrade = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const row of breakdownRows) {
      const amounts = selectedBids.map((bid) => amountForTrade(bid, row.trade));
      map.set(normalizeTrade(row.trade), lowestAmountIndices(amounts));
    }
    return map;
  }, [breakdownRows, selectedBids]);

  const lowestSubtotalIndices = useMemo(() => {
    const amounts = selectedBids.map((bid) =>
      breakdownSubtotal(bid.terms?.lineItems),
    );
    return lowestAmountIndices(amounts);
  }, [selectedBids]);

  const syncHeights = useCallback(() => {
    syncCompareRowHeights(metricsTableRef.current, bidsTableRef.current);
  }, []);

  useLayoutEffect(() => {
    syncHeights();
  }, [syncHeights, selectedBids, breakdownRows, ballparkMid, t]);

  useEffect(() => {
    const onResize = () => syncHeights();
    window.addEventListener('resize', onResize);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => syncHeights())
        : null;
    if (metricsTableRef.current) {
      resizeObserver?.observe(metricsTableRef.current);
    }
    if (bidsTableRef.current) {
      resizeObserver?.observe(bidsTableRef.current);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
    };
  }, [syncHeights, selectedBids, breakdownRows]);

  const toggleBid = (bidId: string) => {
    setSelectedIds((current) => {
      if (current.includes(bidId)) {
        return current.length > 1 ? current.filter((id) => id !== bidId) : current;
      }
      return [...current, bidId];
    });
  };

  if (bids.length === 0) {
    return null;
  }

  return (
    <section className="card bids-compare-card">
      <div className="bids-compare-header">
        <h2 className="section-title">{t('bidCompare.title')}</h2>
        <p className="muted bids-compare-hint">{t('bidCompare.hint')}</p>
      </div>

      <div
        className="bids-compare-picker"
        role="group"
        aria-label={t('bidCompare.pickerAria')}
      >
        {bids.map((bid) => {
          const active = selectedIds.includes(bid.id);
          const updated = isUpdatedProposal(bid);
          return (
            <button
              key={bid.id}
              type="button"
              className={`filter-chip${active ? ' filter-chip-active' : ''}`}
              aria-pressed={active}
              onClick={() => toggleBid(bid.id)}
            >
              <span className="bids-compare-picker-label">
                {bid.companyName ?? t('common.contractor')}
                <span
                  className={`bids-compare-proposal-kind${
                    updated ? ' bids-compare-proposal-kind--updated' : ''
                  }`}
                >
                  {updated
                    ? t('bidCompare.updatedProposal')
                    : t('bidCompare.initialProposal')}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="bids-compare-table-layout">
        <div className="bids-compare-metrics-pane">
          <table
            ref={metricsTableRef}
            className="bids-compare-table bids-compare-table--metrics"
          >
            <thead>
              <tr>
                <th scope="col">{t('bidCompare.metric')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{t('bidCompare.total')}</th>
              </tr>
              <tr>
                <th scope="row">{t('bidCompare.duration')}</th>
              </tr>
              <tr>
                <th scope="row">{t('bidCompare.worksStartDate')}</th>
              </tr>
              <tr>
                <th scope="row">{t('bidCompare.worksFinishDate')}</th>
              </tr>
              <tr>
                <th scope="row">{t('bidCompare.vsBallpark')}</th>
              </tr>
              <tr>
                <th scope="row">{t('bidCompare.scope')}</th>
              </tr>
              {breakdownRows.length > 0 && (
                <>
                  <tr className="bids-compare-breakdown-divider">
                    <th scope="row" className="bids-compare-breakdown-heading">
                      {t('bidCompare.breakdownByTrade')}
                    </th>
                  </tr>
                  {breakdownRows.map((row) => (
                    <tr key={`metric-${normalizeTrade(row.trade)}`}>
                      <th
                        scope="row"
                        className="bids-compare-breakdown-row-label"
                      >
                        <span className="bids-compare-breakdown-trade-name">
                          {row.trade}
                        </span>
                        {row.description ? (
                          <span className="bids-compare-breakdown-desc muted">
                            {row.description}
                          </span>
                        ) : null}
                      </th>
                    </tr>
                  ))}
                  <tr className="bids-compare-breakdown-subtotal-row">
                    <th scope="row">{t('bidCompare.breakdownSubtotal')}</th>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="bids-compare-bids-scroll">
          <table
            ref={bidsTableRef}
            className="bids-compare-table bids-compare-table--bids"
          >
            <thead>
              <tr>
                {selectedBids.map((bid) => {
                  const updated = isUpdatedProposal(bid);
                  return (
                    <th key={bid.id} scope="col" className="bids-compare-bid-col">
                      <div className="bids-compare-bid-header">
                        <span className="bids-compare-bid-company">
                          {bid.companyName ?? t('common.contractor')}
                        </span>
                        <span
                          className={`bids-compare-proposal-kind${
                            updated ? ' bids-compare-proposal-kind--updated' : ''
                          }`}
                        >
                          {updated
                            ? t('bidCompare.updatedProposal')
                            : t('bidCompare.initialProposal')}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                {selectedBids.map((bid) => (
                  <td key={`${bid.id}-total`} className="bids-compare-bid-col">
                    {bid.amount != null
                      ? formatThb(Number(bid.amount))
                      : t('common.dash')}
                  </td>
                ))}
              </tr>
              <tr>
                {selectedBids.map((bid) => (
                  <td key={`${bid.id}-duration`} className="bids-compare-bid-col">
                    {bid.durationDays != null
                      ? t('common.daysCount', { n: bid.durationDays })
                      : t('common.dash')}
                  </td>
                ))}
              </tr>
              <tr>
                {selectedBids.map((bid) => {
                  const start = formatCompareDate(
                    bid.terms?.contractTerms?.worksStartDate,
                  );
                  return (
                    <td
                      key={`${bid.id}-works-start`}
                      className="bids-compare-bid-col"
                    >
                      {start ?? t('common.dash')}
                    </td>
                  );
                })}
              </tr>
              <tr>
                {selectedBids.map((bid) => {
                  const finish = formatCompareDate(
                    bid.terms?.contractTerms?.worksFinishDate,
                  );
                  return (
                    <td
                      key={`${bid.id}-works-finish`}
                      className="bids-compare-bid-col"
                    >
                      {finish ?? t('common.dash')}
                    </td>
                  );
                })}
              </tr>
              <tr>
                {selectedBids.map((bid) => {
                  const amount = bid.amount != null ? Number(bid.amount) : null;
                  const worksAmount =
                    amount != null
                      ? bidWorksSubtotalForCompare(bid.terms, amount)
                      : null;
                  return (
                    <td key={`${bid.id}-delta`} className="bids-compare-bid-col">
                      {worksAmount != null
                        ? formatBallparkDelta(worksAmount, ballparkMid ?? null, t)
                        : t('common.dash')}
                    </td>
                  );
                })}
              </tr>
              <tr>
                {selectedBids.map((bid) => (
                  <td
                    key={`${bid.id}-scope`}
                    className="bids-compare-text-cell bids-compare-bid-col"
                  >
                    {bid.terms?.scopeSummary?.trim() || t('common.dash')}
                  </td>
                ))}
              </tr>
              {breakdownRows.length > 0 && (
                <>
                  <tr className="bids-compare-breakdown-divider">
                    {selectedBids.map((bid) => (
                      <td
                        key={`${bid.id}-breakdown-heading`}
                        className="bids-compare-bid-col bids-compare-breakdown-heading-spacer"
                        aria-hidden
                      />
                    ))}
                  </tr>
                  {breakdownRows.map((row) => {
                    const lowest = lowestByTrade.get(normalizeTrade(row.trade));
                    return (
                      <tr key={`bid-${normalizeTrade(row.trade)}`}>
                        {selectedBids.map((bid, index) => {
                          const amount = amountForTrade(bid, row.trade);
                          const isLowest = lowest?.has(index) ?? false;
                          return (
                            <td
                              key={`${bid.id}-${row.trade}`}
                              className={`bids-compare-bid-col${
                                isLowest ? ' bids-compare-cell-lowest' : ''
                              }`}
                            >
                              {amount != null
                                ? formatThb(amount)
                                : t('common.dash')}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr className="bids-compare-breakdown-subtotal-row">
                    {selectedBids.map((bid, index) => {
                      const subtotal = breakdownSubtotal(bid.terms?.lineItems);
                      const isLowest = lowestSubtotalIndices.has(index);
                      return (
                        <td
                          key={`${bid.id}-subtotal`}
                          className={`bids-compare-bid-col${
                            isLowest ? ' bids-compare-cell-lowest' : ''
                          }`}
                        >
                          {subtotal != null
                            ? formatThb(subtotal)
                            : t('common.dash')}
                        </td>
                      );
                    })}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

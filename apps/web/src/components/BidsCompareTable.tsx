'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { formatThb } from '@/lib/estimate';
import { bidWorksSubtotalForCompare } from '@/lib/bid-cost-adjustments';
import type { Bid, BidLineItem, DefaultCostBreakdownItem } from '@/lib/tendering';

interface BidsCompareTableProps {
  bids: Bid[];
  ballparkMid?: number | null;
  defaultCostBreakdown?: DefaultCostBreakdownItem[];
}

function deltaLabel(amount: number, ballparkMid: number | null | undefined): string {
  if (!ballparkMid || ballparkMid <= 0) return '—';
  const delta = Math.round(((amount - ballparkMid) / ballparkMid) * 100);
  return `${delta >= 0 ? '+' : ''}${delta}%`;
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

export function BidsCompareTable({
  bids,
  ballparkMid,
  defaultCostBreakdown = [],
}: BidsCompareTableProps) {
  const { t } = useTranslation();
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
        <p className="muted bids-compare-hint">
          {t('bidCompare.hint')}
        </p>
      </div>

      <div className="bids-compare-picker" role="group" aria-label={t('bidCompare.pickerAria')}>
        {bids.map((bid) => {
          const active = selectedIds.includes(bid.id);
          return (
            <button
              key={bid.id}
              type="button"
              className={`filter-chip${active ? ' filter-chip-active' : ''}`}
              aria-pressed={active}
              onClick={() => toggleBid(bid.id)}
            >
              {bid.companyName ?? t('common.contractor')}
            </button>
          );
        })}
      </div>

      <div className="bids-compare-table-wrap">
        <table className="bids-compare-table">
          <thead>
            <tr>
              <th scope="col" className="bids-compare-sticky-col">
                {t('bidCompare.metric')}
              </th>
              {selectedBids.map((bid) => (
                <th key={bid.id} scope="col" className="bids-compare-bid-col">
                  {bid.companyName ?? t('common.contractor')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="bids-compare-sticky-col">
                {t('bidCompare.total')}
              </th>
              {selectedBids.map((bid) => (
                <td key={`${bid.id}-total`} className="bids-compare-bid-col">
                  {bid.amount != null ? formatThb(Number(bid.amount)) : t('common.dash')}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="bids-compare-sticky-col">
                {t('bidCompare.duration')}
              </th>
              {selectedBids.map((bid) => (
                <td key={`${bid.id}-duration`} className="bids-compare-bid-col">
                  {bid.durationDays != null
                    ? t('common.daysCount', { n: bid.durationDays })
                    : t('common.dash')}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="bids-compare-sticky-col">
                {t('bidCompare.vsBallpark')}
              </th>
              {selectedBids.map((bid) => {
                const amount = bid.amount != null ? Number(bid.amount) : null;
                const worksAmount =
                  amount != null
                    ? bidWorksSubtotalForCompare(bid.terms, amount)
                    : null;
                return (
                  <td key={`${bid.id}-delta`} className="bids-compare-bid-col">
                    {worksAmount != null
                      ? deltaLabel(worksAmount, ballparkMid ?? null)
                      : t('common.dash')}
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row" className="bids-compare-sticky-col">
                {t('bidCompare.scope')}
              </th>
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
                  <th
                    scope="row"
                    colSpan={1 + selectedBids.length}
                    className="bids-compare-breakdown-heading"
                  >
                    {t('bidCompare.breakdownByTrade')}
                  </th>
                </tr>
                {breakdownRows.map((row) => {
                  const lowest = lowestByTrade.get(normalizeTrade(row.trade));
                  return (
                    <tr key={normalizeTrade(row.trade)}>
                      <th
                        scope="row"
                        className="bids-compare-breakdown-row-label bids-compare-sticky-col"
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
                            {amount != null ? formatThb(amount) : t('common.dash')}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="bids-compare-breakdown-subtotal-row">
                  <th scope="row" className="bids-compare-sticky-col">
                    {t('bidCompare.breakdownSubtotal')}
                  </th>
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
                        {subtotal != null ? formatThb(subtotal) : t('common.dash')}
                      </td>
                    );
                  })}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

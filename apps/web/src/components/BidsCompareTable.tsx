'use client';

import { useMemo, useState } from 'react';
import { formatThb } from '@/lib/estimate';
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

export function BidsCompareTable({
  bids,
  ballparkMid,
  defaultCostBreakdown = [],
}: BidsCompareTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    bids.slice(0, Math.min(3, bids.length)).map((bid) => bid.id),
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

  const toggleBid = (bidId: string) => {
    setSelectedIds((current) => {
      if (current.includes(bidId)) {
        return current.length > 1 ? current.filter((id) => id !== bidId) : current;
      }
      if (current.length >= 4) {
        return [...current.slice(1), bidId];
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
        <h2 className="section-title">Compare bids</h2>
        <p className="muted bids-compare-hint">
          Select up to 4 contractors to compare side by side.
        </p>
      </div>

      <div className="bids-compare-picker" role="group" aria-label="Bids to compare">
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
              {bid.companyName ?? 'Contractor'}
            </button>
          );
        })}
      </div>

      <div className="bids-compare-table-wrap">
        <table className="bids-compare-table">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              {selectedBids.map((bid) => (
                <th key={bid.id} scope="col">
                  {bid.companyName ?? 'Contractor'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Total</th>
              {selectedBids.map((bid) => (
                <td key={`${bid.id}-total`}>
                  {bid.amount != null ? formatThb(Number(bid.amount)) : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Duration</th>
              {selectedBids.map((bid) => (
                <td key={`${bid.id}-duration`}>
                  {bid.durationDays != null ? `${bid.durationDays} days` : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">vs ballpark</th>
              {selectedBids.map((bid) => (
                <td key={`${bid.id}-delta`}>
                  {bid.amount != null
                    ? deltaLabel(Number(bid.amount), ballparkMid ?? null)
                    : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Scope</th>
              {selectedBids.map((bid) => (
                <td key={`${bid.id}-scope`} className="bids-compare-text-cell">
                  {bid.terms?.scopeSummary?.trim() || '—'}
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
                    Cost breakdown by trade
                  </th>
                </tr>
                {breakdownRows.map((row) => (
                  <tr key={normalizeTrade(row.trade)}>
                    <th scope="row" className="bids-compare-breakdown-row-label">
                      <span className="bids-compare-breakdown-trade-name">
                        {row.trade}
                      </span>
                      {row.description ? (
                        <span className="bids-compare-breakdown-desc muted">
                          {row.description}
                        </span>
                      ) : null}
                    </th>
                    {selectedBids.map((bid) => {
                      const amount = amountForTrade(bid, row.trade);
                      return (
                        <td key={`${bid.id}-${row.trade}`}>
                          {amount != null ? formatThb(amount) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bids-compare-breakdown-subtotal-row">
                  <th scope="row">Breakdown subtotal</th>
                  {selectedBids.map((bid) => {
                    const subtotal = breakdownSubtotal(bid.terms?.lineItems);
                    return (
                      <td key={`${bid.id}-subtotal`}>
                        {subtotal != null ? formatThb(subtotal) : '—'}
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

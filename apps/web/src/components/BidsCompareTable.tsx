'use client';

import { useMemo, useState } from 'react';
import { formatThb } from '@/lib/estimate';
import type { Bid } from '@/lib/tendering';

interface BidsCompareTableProps {
  bids: Bid[];
  ballparkMid?: number | null;
}

function deltaLabel(amount: number, ballparkMid: number | null | undefined): string {
  if (!ballparkMid || ballparkMid <= 0) return '—';
  const delta = Math.round(((amount - ballparkMid) / ballparkMid) * 100);
  return `${delta >= 0 ? '+' : ''}${delta}%`;
}

export function BidsCompareTable({ bids, ballparkMid }: BidsCompareTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    bids.slice(0, Math.min(3, bids.length)).map((bid) => bid.id),
  );

  const selectedBids = useMemo(
    () => bids.filter((bid) => selectedIds.includes(bid.id)),
    [bids, selectedIds],
  );

  const allTrades = useMemo(() => {
    const trades = new Set<string>();
    for (const bid of selectedBids) {
      for (const item of bid.terms?.lineItems ?? []) {
        trades.add(item.trade);
      }
    }
    return [...trades];
  }, [selectedBids]);

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
                <td key={`${bid.id}-total`}>{formatThb(Number(bid.amount))}</td>
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
                  {deltaLabel(Number(bid.amount), ballparkMid ?? null)}
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
            {allTrades.map((trade) => (
              <tr key={trade}>
                <th scope="row">{trade}</th>
                {selectedBids.map((bid) => {
                  const item = bid.terms?.lineItems?.find(
                    (line) => line.trade === trade,
                  );
                  return (
                    <td key={`${bid.id}-${trade}`}>
                      {item ? formatThb(item.amount) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

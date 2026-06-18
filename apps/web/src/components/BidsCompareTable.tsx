'use client';

import { useMemo, useState } from 'react';
import { formatThb } from '@/lib/estimate';
import type { Bid, BidLineItem } from '@/lib/tendering';

interface BidsCompareTableProps {
  bids: Bid[];
  ballparkMid?: number | null;
}

function deltaLabel(amount: number, ballparkMid: number | null | undefined): string {
  if (!ballparkMid || ballparkMid <= 0) return '—';
  const delta = Math.round(((amount - ballparkMid) / ballparkMid) * 100);
  return `${delta >= 0 ? '+' : ''}${delta}%`;
}

function CompareBreakdownCell({ items }: { items?: BidLineItem[] }) {
  if (!items?.length) {
    return <span className="muted">Not provided</span>;
  }

  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );

  return (
    <table className="bids-compare-breakdown-table">
      <tbody>
        {items.map((item, index) => (
          <tr key={index}>
            <td className="bids-compare-breakdown-trade">
              <span className="bids-compare-breakdown-trade-name">{item.trade}</span>
              {item.description ? (
                <span className="bids-compare-breakdown-desc muted">
                  {item.description}
                </span>
              ) : null}
            </td>
            <td className="bids-compare-breakdown-amount">
              {formatThb(item.amount)}
            </td>
          </tr>
        ))}
        {items.length > 1 && (
          <tr className="bids-compare-breakdown-subtotal">
            <td>Subtotal</td>
            <td>{formatThb(subtotal)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function BidsCompareTable({ bids, ballparkMid }: BidsCompareTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    bids.slice(0, Math.min(3, bids.length)).map((bid) => bid.id),
  );

  const selectedBids = useMemo(
    () => bids.filter((bid) => selectedIds.includes(bid.id)),
    [bids, selectedIds],
  );

  const hasAnyBreakdown = useMemo(
    () =>
      selectedBids.some((bid) => (bid.terms?.lineItems?.length ?? 0) > 0),
    [selectedBids],
  );

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
            {hasAnyBreakdown && (
              <tr>
                <th scope="row">Cost breakdown</th>
                {selectedBids.map((bid) => (
                  <td key={`${bid.id}-breakdown`} className="bids-compare-breakdown-cell">
                    <CompareBreakdownCell items={bid.terms?.lineItems} />
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

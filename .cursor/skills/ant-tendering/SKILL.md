---
name: ant-tendering
description: >-
  Ant tendering and bid workflow rules: statuses, client vs contractor edits,
  counter-offers vs direct Save terms, compare-bids after award. Use when
  changing bids, tenders, KP submission, award, counter-offers, or bid compare UI.
---

# Ant tendering & bids

## Status cheat sheet

**Tender:** `draft` → `open` → `closed` → `awarded` (also `cancelled`).

**Bid (typical path):** `clarifying` / `enrolled` → `submitted` → `selected` | `rejected` | `withdrawn`.

After award, former submitted peers become `rejected`; winner is `selected`. Comparison and analysis must still treat **submitted + selected + rejected** with amounts as comparable proposals (`isComparableProposalBid` in `apps/web/src/lib/tendering.ts`).

## Who may change what

Contract term field audiences: `apps/web/src/lib/contract-terms-fields.ts`

| Audience | Editable |
|----------|----------|
| Shared | Payment, schedule, retention, warranty notes, special conditions, … |
| Client-only | Site address, property ownership, employer legal fields |
| Contractor-only | Subject of contract, contractor address/reg/representative |

### Critical product rule

After the contractor submits a KP, the **client must not silently overwrite commercial terms** via **Save terms**.

- Pre-award client view of contractor KP: **read-only** (`ClientCommercialProposalPanel` with `readOnly`).
- Commercial changes → **counter-offer** (`ClientCounterOfferPanel`).
- API: `updateBidContractTermsForClient` rejects direct updates on `submitted` / `rejected`; after `selected`, only client-only fields may merge.

Do not reintroduce editable Save terms on the applications card for open negotiation.

## Compare bids page

- Path: `apps/web/src/app/projects/[id]/bids/page.tsx`
- Keep accessible after award / signed contract.
- Refresh button uses **silent** reload (do not blank the whole page).
- Compare table / analysis: use comparable proposals, not only `status === 'submitted'`.

## KP form UX

- Template + custom text fields: `ContractTermsTextOptionField` — keep the text input **always visible**; selecting a template fills text; Custom must not snap back while editing.
- Publish modal preview load: only when the modal opens / `projectId` changes — avoid remounting mid-edit on parent re-renders.

## Checklist for tendering changes

```
- [ ] Status transitions match existing enum usage in Prisma + UI filters
- [ ] Client cannot mutate contractor commercial terms without counter-offer
- [ ] Post-award compare still shows historical proposals
- [ ] Notifications still fire on submit/enroll/decline if behavior changed
```

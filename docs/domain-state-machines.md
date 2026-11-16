# Domain State Machines — MVP

State machines for core aggregates. All transitions must write an `audit_events` record.

---

## 1. Project

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> intake: start_ai_intake
  intake --> intake: update_brief
  intake --> ready_for_estimate: readiness_threshold_met
  ready_for_estimate --> estimated: estimate_generated
  estimated --> in_tender: tender_published
  in_tender --> awarded: winning_bid_selected
  awarded --> active: contract_signed_by_both
  active --> completed: project_closed
  completed --> [*]

  intake --> draft: client_archives
  estimated --> intake: major_brief_revision
```

| Status | Description |
|--------|-------------|
| `draft` | Created, minimal data |
| `intake` | AI-assisted data collection in progress |
| `ready_for_estimate` | Required brief fields satisfied |
| `estimated` | At least one estimate exists |
| `in_tender` | Tender open or collecting bids |
| `awarded` | Winning bid chosen; awaiting contract signatures |
| `active` | Contract signed by both parties; work in progress |
| `completed` | Project closed, reviews enabled |

**Readiness threshold:** configurable score (e.g. 80/100) based on required `brief_json` fields and mandatory attachments.

---

## 2. Tender

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> collecting_participants: invitations_sent
  collecting_participants --> open: client_starts_tender
  open --> closed: deadline_reached OR client_closes
  closed --> awarded: bid_selected
  awarded --> [*]
  closed --> cancelled: client_cancels
  cancelled --> [*]
```

| Status | Who can act |
|--------|-------------|
| `draft` | System prepares invite list |
| `collecting_participants` | Contractors accept/decline invite |
| `open` | Contractors submit bids; Q&A active |
| `closed` | No new bids; comparison phase |
| `awarded` | Linked to selected `bid_id` |
| `cancelled` | No award |

**Auto transitions:**
- `open` → `closed` when `closes_at` reached (worker job)
- Reminder notifications at T-48h, T-24h before close

---

## 3. Tender Invitation

| Status | Description |
|--------|-------------|
| `pending` | Sent, no response |
| `accepted` | Contractor will participate |
| `declined` | Contractor opted out |
| `expired` | No response before tender open |

---

## 4. Bid

| Status | Description |
|--------|-------------|
| `submitted` | Immutable after lock period (optional MVP: fully immutable) |
| `withdrawn` | Contractor withdrew before tender close |
| `selected` | Chosen as winning bid |
| `rejected` | Not selected after award |

**Rule:** One `selected` bid per tender. Selecting a bid triggers project → `awarded` and creates a contract record awaiting signatures.

---

## 5. Contract

```mermaid
stateDiagram-v2
  [*] --> generating
  generating --> draft: document_ready
  draft --> sent: sent_to_parties
  sent --> accepted: both_parties_accepted
  sent --> void: cancelled_before_accept
  accepted --> [*]
  void --> [*]
```

MVP acceptance: click-to-accept on platform (no e-signature provider).

**Platform fees (contractor-paid, trial disclosure):** Before the contractor signs, the UI shows the listed **signing fee** (USD 20 or 2% of the contract — whichever is lower, credited toward the success fee) and **remaining success fee** (2% minus credit, due within two weeks). During trial the payable amount is **0** (100% discount). The trial end date is set by an admin in **Admin → Settings** (`PlatformSettings.trialEndsAt`, stored as the last instant of the chosen day UTC); with no date configured the trial keeps running. `ContractSignatureRequest` snapshots `trialActive`, `dueNowListed` and `dueNowPayable` when it is created, so requests made during the trial stay at USD 0 after the end date passes. Clients see an informational note that they use the core platform for free until premium services are enabled. No payment capture in MVP.

**Free trial end date.** The launch-period trial ends on **31 December 2026, 23:59:59.999 UTC**. Two things hold that date:

| Where | What |
|-------|------|
| `apps/api/prisma/migrations/20261116120000_platform_trial_ends_2026_12_31` | Moves `platform_settings.trial_ends_at` to the date (created if missing). Only moves it **forward** — a later date already configured by an admin wins. Runs on container start (`prisma migrate deploy` in `docker-entrypoint.sh`). |
| `DEFAULT_TRIAL_ENDS_AT` (`apps/api/src/notifications/platform-fees.ts`) | The same instant, used when the settings row is created, so a fresh database starts with a real end date instead of an open-ended trial. |

Resolution stays data-driven: `resolveTrialActive(trialEndsAt)` compares the stored date with `now`; only when the date is `null` does it fall back to the compile-time `PLATFORM_FEES_TRIAL_ACTIVE` flag. To change the end date later, set it in **Admin → Settings** — no deploy needed. The UI shows it as “Бесплатно до {date}” / “Free until {date}” (`platformFees.trialEndsOn`).


---

## 6. Contractor Verification

| Status | Description |
|--------|-------------|
| `pending` | Registered, not verified |
| `verified` | Admin approved; eligible for auto-invite |
| `suspended` | Cannot receive new tenders |
| `rejected` | Application denied |

Only `verified` contractors enter automated tender distribution.

---

## 7. Support Ticket

| Status | Description |
|--------|-------------|
| `open` | Created |
| `in_progress` | Support assigned |
| `resolved` | Answer provided |
| `closed` | Confirmed by user or auto-close |

**Policy:** Tickets tagged `construction_advice` are auto-replied with scope disclaimer and not escalated to technical staff.

---

## 8. Authorization Matrix (Simplified)

| Action | Client | Contractor | Admin |
|--------|--------|------------|-------|
| Update brief | own project | — | — |
| Publish tender | own project | — | yes |
| Submit bid | — | invited + open tender | — |
| Select bid | own project | — | yes |
| Accept contract | own project | winning contractor | — |
| Verify contractor | — | — | yes |
| Post progress update | — | assigned project | — |

---

## 9. Domain Events (for Outbox)

| Event | Triggers |
|-------|----------|
| `project.ready_for_estimate` | Estimation job |
| `estimate.completed` | Notification to client |
| `tender.published` | Invitation emails |
| `tender.question.created` | Notify client |
| `bid.submitted` | Notify client; WS broadcast |
| `bid.selected` | Contract generation job |
| `contract.accepted` | Project → active; notify parties |
| `project.completed` | Review request notification |

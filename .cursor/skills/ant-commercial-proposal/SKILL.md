---
name: ant-commercial-proposal
description: >-
  Guides Ant commercial proposal (KP) and contract draft PDF work: TipTap
  englishBodyHtml, multilingual download, BOQ tables, contract terms fields.
  Use when editing KP forms, contract document editor, PDF download, BOQ,
  englishBodyHtml, or commercial-proposal template/service code.
---

# Ant commercial proposal & contract PDF

## Mental model

| Layer | Role |
|-------|------|
| Bid `termsJson.contractTerms` + line items | Structured source of truth for regenerated PDFs |
| `Contract.englishBodyHtml` | Free-form TipTap EN draft after award; used for EN PDF |
| Template regeneration | Builds TH/RU (and EN when no edited body) from structured terms |

Key files:

- UI form: `apps/web/src/components/BidContractTermsFields.tsx`
- TipTap editor: `apps/web/src/components/ContractDocumentEditor.tsx`
- Download UI: `apps/web/src/components/CommercialProposalDownload.tsx`
- API: `apps/api/src/tendering/commercial-proposal.service.ts`
- HTML/PDF: `apps/api/src/tendering/commercial-proposal.template.ts`
- Sanitize: `apps/api/src/tendering/contract-html.sanitize.ts`

## Schedule fields

- Prefer **works start date** + **works finish date**.
- **Contract period** = calendar days between them (auto); keep `contractPeriodMonths` derived for legacy/payment wording.
- Helpers: `calendarDaysBetween`, `inferWorksFinishDate` in `contract-terms-inference.ts` (web + api).

## PDF download rules

1. **Single EN** → `tryRenderEditedEnglishPdf` if `englishBodyHtml` exists; else regenerate.
2. **Multi-locale** → if `englishBodyHtml` exists and `en` is selected, inject edited EN as a full language block; regenerate other locales. Do **not** drop TipTap edits by regenerating EN from the template.
3. Before rendering edited EN, call `ensureEditedEnglishBodyHasBoq` so a missing BOQ table is reinjected from live line items.

## BOQ / TipTap compatibility

When generating table HTML for the EN body:

- Wrap cell text in `<p>…</p>` (TipTap cells are `block+`).
- Prefer `<tbody>` + header row with `<th>`, **not** `<thead>` (TipTap drops fragile thead tables on load/save).
- Keep `class="boq"` on the table.

## Signatures

- Strip signatures from editable HTML (`stripContractSignaturesBlock`).
- Re-append live signatures when building PDF (`englishContractClosingHtml` / `renderSignaturesBlock`).

## Checklist

```
- [ ] Structured terms still update bid/project JSON when the form saves
- [ ] EN TipTap path preserves edits on multi-language download
- [ ] BOQ visible in EN PDF (table present or reinjected)
- [ ] PDF i18n updated in commercial-proposal.i18n.ts for en/ru/th if copy changed
```

import type { BidLineItem, BidTermsV1 } from './tendering.types';
import type {
  BidContractTerms,
  CommercialProposalRenderData,
} from './commercial-proposal.types';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatThb(amount: number): string {
  return `THB ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDisplayDate(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function monthsFromDays(days?: number | null): number | undefined {
  if (days == null || days < 1) return undefined;
  return Math.max(1, Math.round(days / 30));
}

function buildAdvanceText(
  amount: number,
  terms?: BidContractTerms,
): string {
  if (terms?.advancePaymentAmount != null && terms.advancePaymentAmount > 0) {
    return formatThb(terms.advancePaymentAmount);
  }
  const pct = terms?.advancePaymentPercent;
  if (pct != null && pct > 0) {
    const value = (amount * pct) / 100;
    return `${pct}% of the Contract Amount (${formatThb(value)})`;
  }
  return 'No advance payment.';
}

function buildRetentionText(terms?: BidContractTerms): string {
  const pct = terms?.retentionPercent ?? 10;
  const limit = terms?.retentionLimitPercent ?? 10;
  return `Retention shall be ${pct}% of the value of work executed, subject to a limit of ${limit}% of the Accepted Contract Amount.`;
}

function buildBoqTable(lineItems?: BidLineItem[]): string {
  if (!lineItems?.length) return '';
  const rows = lineItems
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.trade)}</td>
        <td>${escapeHtml(item.description ?? '—')}</td>
        <td class="num">${escapeHtml(formatThb(Number(item.amount)))}</td>
      </tr>`,
    )
    .join('');
  const subtotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
  return `
    <table class="boq">
      <thead>
        <tr>
          <th>Trade / item</th>
          <th>Description</th>
          <th>Amount (THB)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="subtotal">
          <td colspan="2">Subtotal</td>
          <td class="num">${escapeHtml(formatThb(subtotal))}</td>
        </tr>
      </tbody>
    </table>`;
}

function formatDocumentCategory(category: string): string {
  return category.replace(/_/g, ' ');
}

function buildAnnex2Html(
  documents: Array<{ originalName: string; category: string }>,
): string {
  if (!documents.length) {
    return `<p class="clause">Drawings, specifications, and other technical documents uploaded to the project on the platform are deemed part of this Contract when listed here.</p>
    <p class="clause"><em>No project documents are recorded on the platform yet. Annex #2 to be supplemented with drawings and specifications before Works commence.</em></p>`;
  }

  const items = documents
    .map(
      (doc) =>
        `<li><strong>${escapeHtml(formatDocumentCategory(doc.category))}</strong> — ${escapeHtml(doc.originalName)}</li>`,
    )
    .join('');

  return `<p class="clause">The following project documents form Annex #2 (Drawings and Specifications):</p>
    <ul>${items}</ul>
    <p class="clause muted">Full files are available in the project workspace on the platform.</p>`;
}

export function buildCommercialProposalData(input: {
  projectTitle: string;
  projectDistrict?: string | null;
  projectDescription?: string | null;
  clarificationSummary?: string | null;
  bidAmount: number;
  durationDays?: number | null;
  terms: BidTermsV1 | null;
  projectDocuments?: Array<{ originalName: string; category: string }>;
  employerName: string;
  employerEmail?: string | null;
  contractorCompanyName: string;
  submittedAt?: string | null;
}): CommercialProposalRenderData {
  const contract = input.terms?.contractTerms;
  const amount = input.bidAmount;
  const siteAddress =
    contract?.siteAddress?.trim() ||
    input.projectDistrict?.trim() ||
    'To be confirmed on site';
  const subject =
    contract?.subjectOfContract?.trim() ||
    input.terms?.scopeSummary?.trim() ||
    input.projectDescription?.trim() ||
    input.projectTitle;
  const periodMonths =
    contract?.contractPeriodMonths ?? monthsFromDays(input.durationDays);
  const periodText = periodMonths
    ? `${periodMonths} month${periodMonths === 1 ? '' : 's'} from the Works Commencement Date`
    : input.durationDays
      ? `${input.durationDays} days from the Works Commencement Date`
      : 'As per the Master Schedule (Annex #3)';

  const employerBlock = [
    contract?.employerName?.trim() || input.employerName,
    contract?.employerAddress?.trim(),
    contract?.employerRegistrationNo?.trim()
      ? `Registration no. ${contract.employerRegistrationNo.trim()}`
      : input.employerEmail?.trim(),
  ]
    .filter(Boolean)
    .join(', ');

  const contractorBlock = [
    input.contractorCompanyName,
    contract?.contractorAddress?.trim(),
    contract?.contractorRegistrationNo?.trim()
      ? `Registration no. ${contract.contractorRegistrationNo.trim()}`
      : null,
    contract?.contractorRepresentative?.trim()
      ? `Represented by ${contract.contractorRepresentative.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join(', ');

  const lineItems = input.terms?.lineItems;
  const boqTableHtml = buildBoqTable(lineItems);

  return {
    documentTitle: `Commercial Proposal — ${input.projectTitle}`,
    contractHeading: 'CONSTRUCTION CONTRACT',
    projectTitle: input.projectTitle,
    siteAddress,
    documentDate: formatDisplayDate(
      input.submittedAt ?? new Date().toISOString(),
    ),
    employerBlock,
    contractorBlock,
    subjectOfContract: subject,
    propertyOwnership:
      contract?.propertyOwnership?.trim() ||
      'The Employer confirms lawful right to carry out the Works at the Site.',
    scopeSummary:
      input.terms?.scopeSummary?.trim() ||
      'As shown and described in the Contract Documents, Drawings and Specifications (Annex #2).',
    approach: input.terms?.approach?.trim() || '—',
    notes: input.terms?.notes?.trim() || '—',
    contractAmountFormatted: formatThb(amount),
    contractAmountNumeric: amount.toFixed(2),
    advancePaymentText: buildAdvanceText(amount, contract),
    worksStartDate: formatDisplayDate(contract?.worksStartDate),
    contractPeriodText: periodText,
    retentionText: buildRetentionText(contract),
    retentionReleaseText:
      contract?.retentionReleaseNotes?.trim() ||
      'a) Release 50% of retention upon issuance of the Taking-Over Certificate;\n' +
        'b) Release the balance after 12 months from Practical Completion.',
    warrantyText:
      contract?.warrantyPeriodNotes?.trim() ||
      `Defect Notification Period: ${contract?.defectNotificationMonths ?? 24} months from Practical Completion.`,
    delayDamagesText:
      contract?.delayDamagesNotes?.trim() ||
      'Delay damages at 0.2% per day of the Contract Amount, maximum 20% of the Contract Amount.',
    specialConditions: contract?.specialConditions?.trim() ?? '',
    hasSpecialConditions: Boolean(contract?.specialConditions?.trim()),
    boqTableHtml,
    hasBoq: Boolean(lineItems?.length),
    annex2Html: buildAnnex2Html(input.projectDocuments ?? []),
    hasAnnex2Documents: (input.projectDocuments?.length ?? 0) > 0,
    clarificationSummary: input.clarificationSummary?.trim() ?? '',
    hasClarificationSummary: Boolean(input.clarificationSummary?.trim()),
  };
}

export function renderCommercialProposalHtml(
  data: CommercialProposalRenderData,
): string {
  const boqSection = data.hasBoq
    ? `
    <h2>Annex #1 — Bill of Quantity</h2>
    ${data.boqTableHtml}
  `
    : '';

  const annex2Section = `
    <h2>Annex #2 — Drawings and Specifications</h2>
    ${data.annex2Html}
  `;

  const clarificationSection = data.hasClarificationSummary
    ? `
    <h2>Contractor Clarifications</h2>
    <p class="clause pre">${escapeHtml(data.clarificationSummary)}</p>
  `
    : '';

  const specialConditionsSection = data.hasSpecialConditions
    ? `
  <h2>Special Conditions</h2>
  <p class="clause pre">${escapeHtml(data.specialConditions)}</p>
  `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(data.documentTitle)}</title>
  <style>
    :root {
      color-scheme: light;
      --text: #111827;
      --muted: #4b5563;
      --border: #d1d5db;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 2rem 2.5rem;
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.45;
      color: var(--text);
      max-width: 820px;
    }
    h1 {
      text-align: center;
      font-size: 16pt;
      letter-spacing: 0.04em;
      margin: 0 0 0.35rem;
    }
    .subtitle, .project-line, .address-line, .date-line {
      text-align: center;
      margin: 0.15rem 0;
    }
    .project-line { font-weight: 700; }
    .parties { margin: 1.5rem 0; }
    .parties p { margin: 0.65rem 0; }
    h2 {
      font-size: 12pt;
      margin: 1.35rem 0 0.5rem;
      text-transform: uppercase;
    }
    .clause { margin: 0.65rem 0; }
    .clause-num { font-weight: 700; }
    ul { margin: 0.35rem 0 0.35rem 1.25rem; }
    table.boq {
      width: 100%;
      border-collapse: collapse;
      margin: 0.75rem 0 1rem;
      font-size: 11pt;
    }
    table.boq th, table.boq td {
      border: 1px solid var(--border);
      padding: 0.4rem 0.5rem;
      vertical-align: top;
    }
    table.boq th { background: #f8fafc; text-align: left; }
    table.boq td.num, table.boq th:last-child { text-align: right; white-space: nowrap; }
    table.boq tr.subtotal td { font-weight: 700; background: #fafafa; }
    .pre { white-space: pre-wrap; }
    .footer-note {
      margin-top: 2rem;
      font-size: 10pt;
      color: var(--muted);
      border-top: 1px solid var(--border);
      padding-top: 0.75rem;
    }
    @media print {
      body { padding: 0.5in; max-width: none; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(data.contractHeading)}</h1>
  <p class="subtitle">of</p>
  <p class="project-line">${escapeHtml(data.projectTitle)}</p>
  <p class="address-line">${escapeHtml(data.siteAddress)}</p>
  <p class="date-line">${escapeHtml(data.documentDate)}</p>

  <div class="parties">
    <p><strong>By and between:</strong></p>
    <p>${escapeHtml(data.employerBlock)}, hereinafter referred to as the <strong>“Employer”</strong>, and</p>
    <p>${escapeHtml(data.contractorBlock)}, hereinafter referred to as the <strong>“Contractor”</strong>.</p>
    <p>Both Parties agree to make this Contract subject to the following terms and conditions:</p>
  </div>

  <h2>Clause 1 — Definitions</h2>
  <p class="clause"><span class="clause-num">“Construction Works”</span> means ${escapeHtml(data.subjectOfContract)} at ${escapeHtml(data.siteAddress)}.</p>
  <p class="clause"><span class="clause-num">“The Project”</span> means completion of the Works as described in Annex #2 (Drawings and Specifications) and this Contract.</p>
  <p class="clause"><span class="clause-num">Property / site rights:</span> ${escapeHtml(data.propertyOwnership)}</p>

  <h2>Clause 2 — Scope of Works</h2>
  <p class="clause">${escapeHtml(data.scopeSummary)}</p>
  <p class="clause"><strong>Implementation approach:</strong> ${escapeHtml(data.approach)}</p>
  <p class="clause"><strong>Comments / assumptions:</strong> ${escapeHtml(data.notes)}</p>

  <h2>Clause 3 — Contract Amount</h2>
  <p class="clause">The Employer agrees to pay the Contract Amount (including applicable taxes) of <strong>${escapeHtml(data.contractAmountFormatted)}</strong> (THB ${escapeHtml(data.contractAmountNumeric)}) (the <strong>“Contract Amount”</strong>).</p>
  <p class="clause">No adjustment shall be allowed for changes in cost of materials, labour, equipment or services during the Contract period unless agreed in writing as a Variation Order.</p>

  ${boqSection}

  ${annex2Section}

  <h2>Clause 5 — Contract Period</h2>
  <p class="clause"><strong>Works Commencement Date:</strong> ${escapeHtml(data.worksStartDate)}</p>
  <p class="clause">The whole scope of the Works shall be completed within ${escapeHtml(data.contractPeriodText)}.</p>
  <p class="clause"><strong>Delay damages:</strong> ${escapeHtml(data.delayDamagesText)}</p>

  <h2>Clause 6 — Payment, Retention &amp; Warranty</h2>
  <p class="clause"><span class="clause-num">6.1 Advance Payment:</span> ${escapeHtml(data.advancePaymentText)}</p>
  <p class="clause"><span class="clause-num">6.2 Terms of Payment:</span> Progress payments based on monthly interim valuation in accordance with this Contract.</p>
  <p class="clause"><span class="clause-num">6.5 Retention:</span> ${escapeHtml(data.retentionText)}</p>
  <p class="clause"><span class="clause-num">6.6 Release of Retention:</span></p>
  <p class="clause pre">${escapeHtml(data.retentionReleaseText)}</p>
  <p class="clause"><span class="clause-num">6.7 Defect Notification / Warranty:</span> ${escapeHtml(data.warrantyText)}</p>

  ${clarificationSection}

  ${specialConditionsSection}

  <p class="footer-note">
    Draft commercial proposal generated by the platform from submitted bid data.
    This document is intended for review and execution by both Parties; legal review is recommended before signing.
  </p>
</body>
</html>`;
}

export function normalizeContractTerms(
  raw?: BidContractTerms,
): BidContractTerms | undefined {
  if (!raw) return undefined;

  const trim = (v?: string) => v?.trim() || undefined;
  const pct = (v?: number) =>
    v != null && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : undefined;

  const normalized: BidContractTerms = {
    subjectOfContract: trim(raw.subjectOfContract),
    siteAddress: trim(raw.siteAddress),
    propertyOwnership: trim(raw.propertyOwnership),
    employerName: trim(raw.employerName),
    employerAddress: trim(raw.employerAddress),
    employerRegistrationNo: trim(raw.employerRegistrationNo),
    contractorAddress: trim(raw.contractorAddress),
    contractorRegistrationNo: trim(raw.contractorRegistrationNo),
    contractorRepresentative: trim(raw.contractorRepresentative),
    advancePaymentPercent: pct(raw.advancePaymentPercent),
    advancePaymentAmount:
      raw.advancePaymentAmount != null && Number.isFinite(raw.advancePaymentAmount)
        ? Math.max(0, raw.advancePaymentAmount)
        : undefined,
    worksStartDate: trim(raw.worksStartDate),
    contractPeriodMonths:
      raw.contractPeriodMonths != null &&
      Number.isFinite(raw.contractPeriodMonths)
        ? Math.max(1, Math.round(raw.contractPeriodMonths))
        : undefined,
    retentionPercent: pct(raw.retentionPercent),
    retentionLimitPercent: pct(raw.retentionLimitPercent),
    retentionReleaseNotes: trim(raw.retentionReleaseNotes),
    defectNotificationMonths:
      raw.defectNotificationMonths != null &&
      Number.isFinite(raw.defectNotificationMonths)
        ? Math.max(0, Math.round(raw.defectNotificationMonths))
        : undefined,
    warrantyPeriodNotes: trim(raw.warrantyPeriodNotes),
    delayDamagesNotes: trim(raw.delayDamagesNotes),
    specialConditions: trim(raw.specialConditions),
  };

  const hasValue = Object.values(normalized).some(
    (v) => v !== undefined && v !== '',
  );
  return hasValue ? normalized : undefined;
}

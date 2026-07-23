import type { BidLineItem, BidTermsV1 } from './tendering.types';
import type {
  BidContractTerms,
  CommercialProposalRenderData,
} from './commercial-proposal.types';
import {
  commercialProposalCopy,
  sortCommercialProposalLocales,
  type CommercialProposalCopy,
} from './commercial-proposal.i18n';
import type { SupportedLocale } from '../users/locale.types';
import { DEFAULT_LOCALE } from '../users/locale.types';
import { calendarDaysBetween } from './contract-terms-inference';
import { stripContractSignaturesBlock } from './contract-html.sanitize';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatThb(amount: number, locale: SupportedLocale): string {
  const numberLocale =
    locale === 'th' ? 'th-TH' : locale === 'ru' ? 'ru-RU' : 'en-US';
  return `THB ${amount.toLocaleString(numberLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDisplayDate(
  iso: string | null | undefined,
  locale: SupportedLocale,
  dash: string,
): string {
  if (!iso) return dash;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const dateLocale =
    locale === 'th' ? 'th-TH' : locale === 'ru' ? 'ru-RU' : 'en-GB';
  return date.toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function signatureImageHtml(dataUrl: string | null | undefined): string {
  if (!dataUrl?.trim()) {
    return '<span class="signature-line"></span>';
  }
  const trimmed = dataUrl.trim();
  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return '<span class="signature-line"></span>';
  }
  return `<img class="signature-image" src="${trimmed}" alt="" />`;
}

function monthsFromDays(days?: number | null): number | undefined {
  if (days == null || days < 1) return undefined;
  return Math.max(1, Math.round(days / 30));
}

function buildAdvanceText(
  amount: number,
  terms: BidContractTerms | undefined,
  copy: CommercialProposalCopy,
  locale: SupportedLocale,
): string {
  if (terms?.advancePaymentAmount != null && terms.advancePaymentAmount > 0) {
    return formatThb(terms.advancePaymentAmount, locale);
  }
  const pct = terms?.advancePaymentPercent;
  if (pct != null && pct > 0) {
    const value = (amount * pct) / 100;
    return copy.advancePercentOf(pct, formatThb(value, locale));
  }
  return copy.noAdvancePayment;
}

function buildPaymentTermsText(
  periodMonths: number | undefined,
  copy: CommercialProposalCopy,
): string {
  if (periodMonths != null && periodMonths < 2) {
    return `${copy.paymentAdvanceTiming} ${copy.paymentShortPeriodFinal}`;
  }
  return `${copy.paymentAdvanceTiming} ${copy.paymentMonthlyProgress}`;
}

function buildRetentionText(
  terms: BidContractTerms | undefined,
  copy: CommercialProposalCopy,
): string {
  const pct = terms?.retentionPercent ?? 10;
  const limit = terms?.retentionLimitPercent ?? 10;
  return copy.retentionShallBe(pct, limit);
}

function buildBoqTable(
  lineItems: BidLineItem[] | undefined,
  copy: CommercialProposalCopy,
  locale: SupportedLocale,
): string {
  if (!lineItems?.length) return '';
  // TipTap table cells require block content (`<p>…</p>`). Bare text in `<td>`
  // is dropped when the English body is loaded/saved in the contract editor.
  // Prefer `<tbody>` + header row (no `<thead>`) for TipTap compatibility.
  const cell = (text: string, tag: 'td' | 'th' = 'td', className?: string) => {
    const classAttr = className ? ` class="${className}"` : '';
    return `<${tag}${classAttr}><p>${escapeHtml(text)}</p></${tag}>`;
  };
  const rows = lineItems
    .map(
      (item) => `
      <tr>
        ${cell(item.trade)}
        ${cell(item.description ?? copy.dash)}
        ${cell(formatThb(Number(item.amount), locale), 'td', 'num')}
      </tr>`,
    )
    .join('');
  const subtotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
  return `
    <table class="boq">
      <tbody>
        <tr>
          ${cell(copy.boqTrade, 'th')}
          ${cell(copy.boqDescription, 'th')}
          ${cell(copy.boqAmount, 'th')}
        </tr>
        ${rows}
        <tr class="subtotal">
          <td colspan="2"><p>${escapeHtml(copy.boqSubtotal)}</p></td>
          ${cell(formatThb(subtotal, locale), 'td', 'num')}
        </tr>
      </tbody>
    </table>`;
}

function formatDocumentCategory(category: string): string {
  return category.replace(/_/g, ' ');
}

function buildAnnex2Html(
  documents: Array<{ originalName: string; category: string }>,
  copy: CommercialProposalCopy,
): string {
  if (!documents.length) {
    return `<p class="clause">${escapeHtml(copy.annex2EmptyIntro)}</p>
    <p class="clause"><em>${escapeHtml(copy.annex2EmptyNote)}</em></p>`;
  }

  const items = documents
    .map(
      (doc) =>
        `<li><strong>${escapeHtml(formatDocumentCategory(doc.category))}</strong> — ${escapeHtml(doc.originalName)}</li>`,
    )
    .join('');

  return `<p class="clause">${escapeHtml(copy.annex2ListIntro)}</p>
    <ul>${items}</ul>
    <p class="clause muted">${escapeHtml(copy.annex2FilesNote)}</p>`;
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
  employerDisplayName?: string | null;
  contractorCompanyName: string;
  submittedAt?: string | null;
  locale?: SupportedLocale;
  contractorSignatureDataUrl?: string | null;
  employerSignatureDataUrl?: string | null;
  contractorSignedAt?: string | null;
  employerSignedAt?: string | null;
}): CommercialProposalRenderData {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const copy = commercialProposalCopy(locale);
  const contract = input.terms?.contractTerms;
  const amount = input.bidAmount;
  const employerOrgName =
    contract?.employerName?.trim() || input.employerName;
  const employerSignatoryName =
    input.employerDisplayName?.trim() &&
    input.employerDisplayName.trim() !== employerOrgName
      ? input.employerDisplayName.trim()
      : employerOrgName;
  const contractorOrgName = input.contractorCompanyName;
  const contractorSignatoryName =
    contract?.contractorRepresentative?.trim() || contractorOrgName;
  const siteAddress =
    contract?.siteAddress?.trim() ||
    input.projectDistrict?.trim() ||
    copy.siteToBeConfirmed;
  const subject =
    contract?.subjectOfContract?.trim() ||
    input.terms?.scopeSummary?.trim() ||
    input.projectDescription?.trim() ||
    input.projectTitle;
  const periodDaysFromDates = calendarDaysBetween(
    contract?.worksStartDate,
    contract?.worksFinishDate,
  );
  const periodDays =
    periodDaysFromDates ??
    (input.durationDays != null && input.durationDays >= 1
      ? input.durationDays
      : undefined);
  const periodMonths =
    contract?.contractPeriodMonths ??
    monthsFromDays(periodDays) ??
    monthsFromDays(input.durationDays);
  const periodText = periodDays
    ? copy.periodDaysFromStart(periodDays)
    : periodMonths
      ? copy.periodMonthsFromStart(periodMonths)
      : copy.periodMasterSchedule;

  const employerBlock = [
    employerOrgName,
    contract?.employerAddress?.trim(),
    contract?.employerRegistrationNo?.trim()
      ? copy.registrationNo(contract.employerRegistrationNo.trim())
      : input.employerEmail?.trim(),
  ]
    .filter(Boolean)
    .join(', ');

  const contractorBlock = [
    contractorOrgName,
    contract?.contractorAddress?.trim(),
    contract?.contractorRegistrationNo?.trim()
      ? copy.registrationNo(contract.contractorRegistrationNo.trim())
      : null,
    contract?.contractorRepresentative?.trim()
      ? copy.representedBy(contract.contractorRepresentative.trim())
      : null,
  ]
    .filter(Boolean)
    .join(', ');

  const lineItems = input.terms?.lineItems;
  const boqTableHtml = buildBoqTable(lineItems, copy, locale);

  return {
    documentTitle: copy.documentTitle(input.projectTitle),
    contractHeading: copy.contractHeading,
    locale,
    projectTitle: input.projectTitle,
    siteAddress,
    documentDate: formatDisplayDate(
      input.submittedAt ?? new Date().toISOString(),
      locale,
      copy.dash,
    ),
    employerBlock,
    contractorBlock,
    subjectOfContract: subject,
    propertyOwnership:
      contract?.propertyOwnership?.trim() || copy.defaultPropertyOwnership,
    scopeSummary:
      input.terms?.scopeSummary?.trim() || copy.scopeFallback,
    approach: input.terms?.approach?.trim() || copy.dash,
    notes: input.terms?.notes?.trim() || copy.dash,
    contractAmountFormatted: formatThb(amount, locale),
    contractAmountNumeric: amount.toFixed(2),
    advancePaymentText: buildAdvanceText(amount, contract, copy, locale),
    paymentTermsText: buildPaymentTermsText(periodMonths, copy),
    worksStartDate: formatDisplayDate(
      contract?.worksStartDate,
      locale,
      copy.dash,
    ),
    worksFinishDate: formatDisplayDate(
      contract?.worksFinishDate,
      locale,
      copy.dash,
    ),
    contractPeriodText: periodText,
    retentionText: buildRetentionText(contract, copy),
    retentionReleaseText:
      contract?.retentionReleaseNotes?.trim() || copy.defaultRetentionRelease,
    warrantyText:
      contract?.warrantyPeriodNotes?.trim() ||
      copy.defaultWarranty(contract?.defectNotificationMonths ?? 24),
    delayDamagesText:
      contract?.delayDamagesNotes?.trim() || copy.defaultDelayDamages,
    specialConditions: contract?.specialConditions?.trim() ?? '',
    hasSpecialConditions: Boolean(contract?.specialConditions?.trim()),
    boqTableHtml,
    hasBoq: Boolean(lineItems?.length),
    annex2Html: buildAnnex2Html(input.projectDocuments ?? [], copy),
    hasAnnex2Documents: (input.projectDocuments?.length ?? 0) > 0,
    clarificationSummary: input.clarificationSummary?.trim() ?? '',
    hasClarificationSummary: Boolean(input.clarificationSummary?.trim()),
    contractorOrgName,
    contractorSignatoryName,
    contractorSignatoryTitle: copy.defaultContractorTitle,
    contractorSignatureImageHtml: signatureImageHtml(
      input.contractorSignatureDataUrl,
    ),
    contractorSignedDate: formatDisplayDate(
      input.contractorSignedAt,
      locale,
      '',
    ),
    employerOrgName,
    employerSignatoryName,
    employerSignatoryTitle: copy.defaultEmployerTitle,
    employerSignatureImageHtml: signatureImageHtml(
      input.employerSignatureDataUrl,
    ),
    employerSignedDate: formatDisplayDate(input.employerSignedAt, locale, ''),
  };
}

function commercialProposalStyles(): string {
  return `
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
    table.boq p,
    table.contract-editor-table p,
    .locale-block table p {
      margin: 0;
    }
    table.contract-editor-table,
    .locale-block table:not(.boq) {
      width: 100%;
      border-collapse: collapse;
      margin: 0.75rem 0 1rem;
      font-size: 11pt;
    }
    table.contract-editor-table th,
    table.contract-editor-table td,
    .locale-block table:not(.boq) th,
    .locale-block table:not(.boq) td {
      border: 1px solid var(--border);
      padding: 0.4rem 0.5rem;
      vertical-align: top;
    }
    table.contract-editor-table th,
    .locale-block table:not(.boq) th {
      background: #f8fafc;
      text-align: left;
    }
    .pre { white-space: pre-wrap; }
    .locale-block {
      margin-bottom: 1.25rem;
      page-break-inside: avoid;
    }
    .locale-block--header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }
    .locale-block--clause {
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px dotted #e5e7eb;
    }
    .locale-block--clause:last-child {
      border-bottom: none;
      margin-bottom: 1.5rem;
    }
    .locale-block--document + .locale-block--document {
      page-break-before: always;
      break-before: page;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }
    .footer-note {
      margin-top: 2rem;
      font-size: 10pt;
      color: var(--muted);
      border-top: 1px solid var(--border);
      padding-top: 0.75rem;
    }
    .signatures {
      margin-top: 2.5rem;
      page-break-inside: avoid;
    }
    .signatures h2 {
      margin-bottom: 1rem;
      text-transform: none;
    }
    .signature-grid {
      display: table;
      width: 100%;
      table-layout: fixed;
      border-collapse: separate;
      border-spacing: 1.5rem 0;
    }
    .signature-col {
      display: table-cell;
      width: 50%;
      vertical-align: top;
    }
    .signature-party {
      margin: 0 0 1rem;
      font-weight: 700;
    }
    .signature-org {
      margin: 0 0 1.25rem;
      font-size: 11pt;
    }
    .signature-line-block {
      margin: 0 0 0.85rem;
    }
    .signature-line {
      display: block;
      border-bottom: 1px solid var(--text);
      height: 1.6rem;
      margin-bottom: 0.25rem;
    }
    .signature-image {
      display: block;
      max-width: 100%;
      max-height: 4.5rem;
      width: auto;
      height: auto;
      object-fit: contain;
      margin-bottom: 0.25rem;
    }
    .signature-caption {
      margin: 0;
      font-size: 10pt;
      color: var(--muted);
    }
    .signature-filled {
      margin: 0.15rem 0 0;
      min-height: 1.2rem;
    }
    @media print {
      body { padding: 0.5in; max-width: none; }
    }`;
}

/** Signatures + footer appended when rendering the edited EN body to PDF. */
export function englishContractClosingHtml(
  data: CommercialProposalRenderData,
): string {
  const copy = commercialProposalCopy(data.locale);
  return `
  ${renderSignaturesBlock(data, [data.locale as SupportedLocale])}
  <p class="footer-note">
    ${escapeHtml(copy.footerNote)}
  </p>`;
}

export function wrapEnglishContractBodyForPdf(
  bodyHtml: string,
  documentTitle: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(documentTitle)}</title>
  <style>${commercialProposalStyles()}</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

function wrapLocaleBlock(
  html: string,
  locale: SupportedLocale,
  variant: 'header' | 'clause' | 'section' | 'document',
): string {
  return `<div class="locale-block locale-block--${variant}" lang="${escapeHtml(locale)}">${html}</div>`;
}

function renderHeaderAndParties(
  data: CommercialProposalRenderData,
  copy: CommercialProposalCopy,
): string {
  return `
  <h1>${escapeHtml(data.contractHeading)}</h1>
  <p class="subtitle">${escapeHtml(copy.of)}</p>
  <p class="project-line">${escapeHtml(data.projectTitle)}</p>
  <p class="address-line">${escapeHtml(data.siteAddress)}</p>
  <p class="date-line">${escapeHtml(data.documentDate)}</p>
  <div class="parties">
    <p><strong>${escapeHtml(copy.byAndBetween)}</strong></p>
    <p>${escapeHtml(data.employerBlock)}, ${escapeHtml(copy.employerReferred)} <strong>“${escapeHtml(copy.employerLabel)}”</strong>, ${escapeHtml(copy.andConnector)}</p>
    <p>${escapeHtml(data.contractorBlock)}, ${escapeHtml(copy.contractorReferred)} <strong>“${escapeHtml(copy.contractorLabel)}”</strong>.</p>
    <p>${escapeHtml(copy.partiesAgree)}</p>
  </div>`;
}

function renderClause1(
  data: CommercialProposalRenderData,
  copy: CommercialProposalCopy,
): string {
  return `
  <h2>${escapeHtml(copy.clause1)}</h2>
  <p class="clause"><span class="clause-num">${escapeHtml(copy.constructionWorks)}</span> ${escapeHtml(copy.meansAt(data.subjectOfContract, data.siteAddress))}</p>
  <p class="clause"><span class="clause-num">${escapeHtml(copy.theProject)}</span> ${escapeHtml(copy.projectMeans)}</p>
  <p class="clause"><span class="clause-num">${escapeHtml(copy.propertySiteRights)}</span> ${escapeHtml(data.propertyOwnership)}</p>`;
}

function renderClause2(
  data: CommercialProposalRenderData,
  copy: CommercialProposalCopy,
): string {
  return `
  <h2>${escapeHtml(copy.clause2)}</h2>
  <p class="clause">${escapeHtml(data.scopeSummary)}</p>
  <p class="clause"><strong>${escapeHtml(copy.implementationApproach)}</strong> ${escapeHtml(data.approach)}</p>
  <p class="clause"><strong>${escapeHtml(copy.commentsAssumptions)}</strong> ${escapeHtml(data.notes)}</p>`;
}

function renderClause3(
  data: CommercialProposalRenderData,
  copy: CommercialProposalCopy,
): string {
  const amountSentence = copy.employerAgreesToPay(
    data.contractAmountFormatted,
    data.contractAmountNumeric,
  );
  return `
  <h2>${escapeHtml(copy.clause3)}</h2>
  <p class="clause">${escapeHtml(amountSentence)}</p>
  <p class="clause">${escapeHtml(copy.noAdjustment)}</p>`;
}

function renderBoqSection(
  data: CommercialProposalRenderData,
  copy: CommercialProposalCopy,
): string {
  if (!data.hasBoq) return '';
  return `
  <h2>${escapeHtml(copy.annex1Boq)}</h2>
  ${data.boqTableHtml}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * TipTap may drop the BOQ table from englishBodyHtml (cells without `<p>`,
 * or `<thead>`). When rendering PDF from the edited EN body, reinject the
 * live BOQ section if the table is missing.
 */
export function ensureEditedEnglishBodyHasBoq(
  bodyHtml: string,
  data: CommercialProposalRenderData,
): string {
  if (!data.hasBoq || !data.boqTableHtml.trim()) {
    return bodyHtml;
  }

  const copy = commercialProposalCopy('en');
  const hasTable = /<table\b/i.test(bodyHtml);
  if (hasTable) {
    return bodyHtml;
  }

  const boqSection = renderBoqSection(data, copy);
  let body = bodyHtml;

  // Remove orphan Annex #1 heading left behind after TipTap dropped the table.
  body = body.replace(
    new RegExp(
      `<h2\\b[^>]*>\\s*${escapeRegExp(copy.annex1Boq)}\\s*</h2>`,
      'i',
    ),
    '',
  );

  const insertBefore = new RegExp(
    `<h2\\b[^>]*>\\s*(?:${escapeRegExp(copy.annex2Drawings)}|${escapeRegExp(copy.clause5)})\\s*</h2>`,
    'i',
  );
  const match = insertBefore.exec(body);
  if (match) {
    return `${body.slice(0, match.index)}\n${boqSection}\n${body.slice(match.index)}`;
  }

  return `${body}\n${boqSection}`;
}

function renderAnnex2Section(
  data: CommercialProposalRenderData,
  copy: CommercialProposalCopy,
): string {
  return `
  <h2>${escapeHtml(copy.annex2Drawings)}</h2>
  ${data.annex2Html}`;
}

function renderClause5(
  data: CommercialProposalRenderData,
  copy: CommercialProposalCopy,
): string {
  return `
  <h2>${escapeHtml(copy.clause5)}</h2>
  <p class="clause"><strong>${escapeHtml(copy.worksCommencementDate)}</strong> ${escapeHtml(data.worksStartDate)}</p>
  <p class="clause"><strong>${escapeHtml(copy.worksCompletionDate)}</strong> ${escapeHtml(data.worksFinishDate)}</p>
  <p class="clause">${escapeHtml(copy.worksCompletedWithin(data.contractPeriodText))}</p>
  <p class="clause"><strong>${escapeHtml(copy.delayDamages)}</strong> ${escapeHtml(data.delayDamagesText)}</p>`;
}

function renderClause6(
  data: CommercialProposalRenderData,
  copy: CommercialProposalCopy,
): string {
  return `
  <h2>${escapeHtml(copy.clause6)}</h2>
  <p class="clause"><span class="clause-num">${escapeHtml(copy.advancePayment)}</span> ${escapeHtml(data.advancePaymentText)}</p>
  <p class="clause"><span class="clause-num">${escapeHtml(copy.termsOfPayment)}</span> ${escapeHtml(data.paymentTermsText)}</p>
  <p class="clause"><span class="clause-num">${escapeHtml(copy.retention)}</span> ${escapeHtml(data.retentionText)}</p>
  <p class="clause"><span class="clause-num">${escapeHtml(copy.releaseOfRetention)}</span></p>
  <p class="clause pre">${escapeHtml(data.retentionReleaseText)}</p>
  <p class="clause"><span class="clause-num">${escapeHtml(copy.defectWarranty)}</span> ${escapeHtml(data.warrantyText)}</p>`;
}

function renderForceMajeure(copy: CommercialProposalCopy): string {
  return `
  <h2>${escapeHtml(copy.clauseForceMajeure)}</h2>
  <p class="clause"><span class="clause-num">${escapeHtml(copy.forceMajeureDefinitionTitle)}</span> ${escapeHtml(copy.forceMajeureDefinition)}</p>
  <ul>
    ${copy.forceMajeureEvents
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join('')}
  </ul>
  <p class="clause"><span class="clause-num">${escapeHtml(copy.forceMajeureNoticeTitle)}</span> ${escapeHtml(copy.forceMajeureNotice)}</p>
  <p class="clause"><span class="clause-num">${escapeHtml(copy.forceMajeureReliefTitle)}</span> ${escapeHtml(copy.forceMajeureRelief)}</p>`;
}

function renderClarifications(
  data: CommercialProposalRenderData,
  copy: CommercialProposalCopy,
): string {
  if (!data.hasClarificationSummary) return '';
  return `
  <h2>${escapeHtml(copy.clarifications)}</h2>
  <p class="clause pre">${escapeHtml(data.clarificationSummary)}</p>`;
}

function renderSpecialConditions(data: CommercialProposalRenderData, copy: CommercialProposalCopy): string {
  if (!data.hasSpecialConditions) return '';
  return `
  <h2>${escapeHtml(copy.specialConditions)}</h2>
  <p class="clause pre">${escapeHtml(data.specialConditions)}</p>`;
}

function joinMultilingualLabels(
  locales: SupportedLocale[],
  pick: (copy: CommercialProposalCopy) => string,
): string {
  return locales
    .map((locale) => pick(commercialProposalCopy(locale)))
    .join(' / ');
}

function renderSignaturesBlock(
  data: CommercialProposalRenderData,
  locales: SupportedLocale[],
): string {
  const headingLocales =
    locales.length > 0 ? locales : [data.locale as SupportedLocale];
  const signaturesHeading = joinMultilingualLabels(
    headingLocales,
    (copy) => copy.signaturesHeading,
  );
  const signatureLabel = joinMultilingualLabels(
    headingLocales,
    (copy) => copy.signatureLabel,
  );
  const nameLabel = joinMultilingualLabels(
    headingLocales,
    (copy) => copy.nameLabel,
  );
  const titleLabel = joinMultilingualLabels(
    headingLocales,
    (copy) => copy.titleLabel,
  );
  const dateLabel = joinMultilingualLabels(
    headingLocales,
    (copy) => copy.dateLabel,
  );
  const forContractor = joinMultilingualLabels(
    headingLocales,
    (copy) => copy.forContractor,
  );
  const forEmployer = joinMultilingualLabels(
    headingLocales,
    (copy) => copy.forEmployer,
  );

  return `
  <div class="signatures">
    <h2>${escapeHtml(signaturesHeading)}</h2>
    <div class="signature-grid">
      <div class="signature-col">
        <p class="signature-party">${escapeHtml(forContractor)}</p>
        <p class="signature-org">${escapeHtml(data.contractorOrgName)}</p>
        <div class="signature-line-block">
          ${data.contractorSignatureImageHtml}
          <p class="signature-caption">${escapeHtml(signatureLabel)}</p>
        </div>
        <div class="signature-line-block">
          <p class="signature-filled">${escapeHtml(data.contractorSignatoryName)}</p>
          <p class="signature-caption">${escapeHtml(nameLabel)}</p>
        </div>
        <div class="signature-line-block">
          <p class="signature-filled">${escapeHtml(data.contractorSignatoryTitle)}</p>
          <p class="signature-caption">${escapeHtml(titleLabel)}</p>
        </div>
        <div class="signature-line-block">
          ${
            data.contractorSignedDate
              ? `<p class="signature-filled">${escapeHtml(data.contractorSignedDate)}</p>`
              : '<span class="signature-line"></span>'
          }
          <p class="signature-caption">${escapeHtml(dateLabel)}</p>
        </div>
      </div>
      <div class="signature-col">
        <p class="signature-party">${escapeHtml(forEmployer)}</p>
        <p class="signature-org">${escapeHtml(data.employerOrgName)}</p>
        <div class="signature-line-block">
          ${data.employerSignatureImageHtml}
          <p class="signature-caption">${escapeHtml(signatureLabel)}</p>
        </div>
        <div class="signature-line-block">
          <p class="signature-filled">${escapeHtml(data.employerSignatoryName)}</p>
          <p class="signature-caption">${escapeHtml(nameLabel)}</p>
        </div>
        <div class="signature-line-block">
          <p class="signature-filled">${escapeHtml(data.employerSignatoryTitle)}</p>
          <p class="signature-caption">${escapeHtml(titleLabel)}</p>
        </div>
        <div class="signature-line-block">
          ${
            data.employerSignedDate
              ? `<p class="signature-filled">${escapeHtml(data.employerSignedDate)}</p>`
              : '<span class="signature-line"></span>'
          }
          <p class="signature-caption">${escapeHtml(dateLabel)}</p>
        </div>
      </div>
    </div>
  </div>`;
}

function renderInterleavedSection(
  locales: SupportedLocale[],
  dataByLocale: Record<string, CommercialProposalRenderData>,
  renderSection: (
    data: CommercialProposalRenderData,
    copy: CommercialProposalCopy,
  ) => string,
  variant: 'clause' | 'section' = 'clause',
): string {
  return locales
    .map((locale) => {
      const data = dataByLocale[locale];
      const copy = commercialProposalCopy(locale);
      const html = renderSection(data, copy);
      if (!html.trim()) return '';
      return wrapLocaleBlock(html, locale, variant);
    })
    .filter(Boolean)
    .join('\n');
}

export function renderCommercialProposalBodyContent(
  data: CommercialProposalRenderData,
): string {
  const copy = commercialProposalCopy(data.locale);
  return `
  ${renderHeaderAndParties(data, copy)}

  ${renderClause1(data, copy)}

  ${renderClause2(data, copy)}

  ${renderClause3(data, copy)}

  ${renderBoqSection(data, copy)}

  ${renderAnnex2Section(data, copy)}

  ${renderClause5(data, copy)}

  ${renderClause6(data, copy)}

  ${renderForceMajeure(copy)}

  ${renderClarifications(data, copy)}

  ${renderSpecialConditions(data, copy)}`;
}

function renderStackedMultilingualWithEditedEnglish(
  dataByLocale: Record<SupportedLocale, CommercialProposalRenderData>,
  locales: SupportedLocale[],
  editedEnglishBodyHtml: string,
): string {
  const ordered = sortCommercialProposalLocales(locales);
  const primary = ordered[0] ?? DEFAULT_LOCALE;
  const primaryData = dataByLocale[primary];
  const primaryCopy = commercialProposalCopy(primary);
  const enData = dataByLocale.en;
  const editedBody = ensureEditedEnglishBodyHasBoq(
    stripContractSignaturesBlock(editedEnglishBodyHtml),
    enData,
  );

  const documents = ordered
    .map((locale) => {
      if (locale === 'en') {
        return wrapLocaleBlock(editedBody, 'en', 'document');
      }
      return wrapLocaleBlock(
        renderCommercialProposalBodyContent(dataByLocale[locale]),
        locale,
        'document',
      );
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="multi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(primaryData.documentTitle)}</title>
  <style>${commercialProposalStyles()}</style>
</head>
<body>
  ${documents}
  ${renderSignaturesBlock(primaryData, ordered)}
  <p class="footer-note">
    ${escapeHtml(primaryCopy.footerNote)}
  </p>
</body>
</html>`;
}

export function renderMultilingualCommercialProposalHtml(
  dataByLocale: Record<SupportedLocale, CommercialProposalRenderData>,
  locales: SupportedLocale[],
  options?: { editedEnglishBodyHtml?: string | null },
): string {
  const ordered = sortCommercialProposalLocales(locales);
  const editedEnglish = options?.editedEnglishBodyHtml?.trim();
  if (editedEnglish && ordered.includes('en')) {
    return renderStackedMultilingualWithEditedEnglish(
      dataByLocale,
      ordered,
      editedEnglish,
    );
  }

  const primary = ordered[0] ?? DEFAULT_LOCALE;
  const primaryData = dataByLocale[primary];
  const primaryCopy = commercialProposalCopy(primary);
  const documentTitle = primaryData.documentTitle;

  const headers = ordered
    .map((locale) =>
      wrapLocaleBlock(
        renderHeaderAndParties(dataByLocale[locale], commercialProposalCopy(locale)),
        locale,
        'header',
      ),
    )
    .join('\n');

  const bodySections = [
    renderInterleavedSection(ordered, dataByLocale, renderClause1),
    renderInterleavedSection(ordered, dataByLocale, renderClause2),
    renderInterleavedSection(ordered, dataByLocale, renderClause3),
    renderInterleavedSection(ordered, dataByLocale, renderBoqSection, 'section'),
    renderInterleavedSection(ordered, dataByLocale, renderAnnex2Section, 'section'),
    renderInterleavedSection(ordered, dataByLocale, renderClause5),
    renderInterleavedSection(ordered, dataByLocale, renderClause6),
    renderInterleavedSection(
      ordered,
      dataByLocale,
      (_data, copy) => renderForceMajeure(copy),
    ),
    renderInterleavedSection(ordered, dataByLocale, renderClarifications),
    renderInterleavedSection(ordered, dataByLocale, renderSpecialConditions),
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="multi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(documentTitle)}</title>
  <style>${commercialProposalStyles()}</style>
</head>
<body>
  ${headers}
  ${bodySections}
  ${renderSignaturesBlock(primaryData, ordered)}
  <p class="footer-note">
    ${escapeHtml(primaryCopy.footerNote)}
  </p>
</body>
</html>`;
}

export function renderCommercialProposalHtml(
  data: CommercialProposalRenderData,
): string {
  const copy = commercialProposalCopy(data.locale);

  return `<!DOCTYPE html>
<html lang="${escapeHtml(data.locale)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(data.documentTitle)}</title>
  <style>${commercialProposalStyles()}</style>
</head>
<body>
  ${renderCommercialProposalBodyContent(data)}

  ${renderSignaturesBlock(data, [data.locale as SupportedLocale])}

  <p class="footer-note">
    ${escapeHtml(copy.footerNote)}
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
    worksFinishDate: trim(raw.worksFinishDate),
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

  const periodDays = calendarDaysBetween(
    normalized.worksStartDate,
    normalized.worksFinishDate,
  );
  if (periodDays != null) {
    normalized.contractPeriodMonths = monthsFromDays(periodDays);
  }

  const hasValue = Object.values(normalized).some(
    (v) => v !== undefined && v !== '',
  );
  return hasValue ? normalized : undefined;
}

/** Legal / contract fields for the downloadable commercial proposal document. */
export interface BidContractTerms {
  /** Subject of contract — scope definition (Clause 1). */
  subjectOfContract?: string;
  /** Full site / property address. */
  siteAddress?: string;
  /** Property ownership (title, lease, developer consent, etc.). */
  propertyOwnership?: string;
  /** Employer (client) legal name. */
  employerName?: string;
  employerAddress?: string;
  employerRegistrationNo?: string;
  /** Contractor legal details (optional overrides). */
  contractorAddress?: string;
  contractorRegistrationNo?: string;
  contractorRepresentative?: string;
  /** Advance payment — percent of contract amount (0 = none). */
  advancePaymentPercent?: number;
  /** Optional fixed advance amount (THB); overrides percent when set. */
  advancePaymentAmount?: number;
  /** Works commencement date (ISO date). */
  worksStartDate?: string;
  /** Contract period in months (alternative to duration days on bid). */
  contractPeriodMonths?: number;
  /** Retention % of work executed. */
  retentionPercent?: number;
  /** Retention cap as % of contract amount. */
  retentionLimitPercent?: number;
  /** How retention is released (e.g. 5% on TOC, 5% after 1 year). */
  retentionReleaseNotes?: string;
  /** Defect notification / warranty period in months. */
  defectNotificationMonths?: number;
  /** Free-text warranty notes. */
  warrantyPeriodNotes?: string;
  /** Delay damages note (optional). */
  delayDamagesNotes?: string;
  specialConditions?: string;
}

export interface CommercialProposalRenderData {
  documentTitle: string;
  contractHeading: string;
  projectTitle: string;
  siteAddress: string;
  documentDate: string;
  employerBlock: string;
  contractorBlock: string;
  subjectOfContract: string;
  propertyOwnership: string;
  scopeSummary: string;
  approach: string;
  notes: string;
  contractAmountFormatted: string;
  contractAmountNumeric: string;
  advancePaymentText: string;
  paymentTermsText: string;
  worksStartDate: string;
  contractPeriodText: string;
  retentionText: string;
  retentionReleaseText: string;
  warrantyText: string;
  delayDamagesText: string;
  specialConditions: string;
  hasSpecialConditions: boolean;
  boqTableHtml: string;
  hasBoq: boolean;
  annex2Html: string;
  hasAnnex2Documents: boolean;
  clarificationSummary: string;
  hasClarificationSummary: boolean;
}

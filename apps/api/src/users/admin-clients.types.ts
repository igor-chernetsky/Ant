export interface AdminClientListItem {
  id: string;
  email: string | null;
  displayName: string | null;
  preferredLocale: string;
  createdAt: string;
  projectCount: number;
  activeProjectCount: number;
  lastProjectAt: string | null;
}

export interface AdminClientListPage {
  items: AdminClientListItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AdminClientListQuery {
  q?: string;
  limit?: number;
  offset?: number;
}

export interface AdminClientProjectSummary {
  id: string;
  title: string;
  status: string;
  projectType: string;
  isHidden: boolean;
  locationRegionSlug: string;
  createdAt: string;
  updatedAt: string;
  contractAmount: number | null;
  contractFullySignedAt: string | null;
  platformFeePaid: boolean;
}

export interface AdminClientLegalSnapshot {
  employerName: string | null;
  employerAddress: string | null;
  employerRegistrationNo: string | null;
  sourceProjectId: string | null;
  sourceProjectTitle: string | null;
}

export interface AdminClientDetail extends AdminClientListItem {
  updatedAt: string;
  legal: AdminClientLegalSnapshot | null;
  projects: AdminClientProjectSummary[];
  /** Reserved for future invoice records. */
  invoices: [];
  /** Reserved for future VAT certificate uploads. */
  vatCertificates: [];
  /** Reserved for future payment / billing profile. */
  paymentInfo: null;
  paymentSlipCount: number;
}

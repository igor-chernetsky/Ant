/**
 * Google Analytics 4 helpers.
 * Set NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXX in env to enable.
 *
 * Do not send PII (email, names, phone) in event params.
 */

export function getGaMeasurementId(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  if (!id || !/^G-[A-Z0-9]+$/i.test(id)) return null;
  return id;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export type AnalyticsParam = string | number | boolean | undefined;

/** Fire a GA4 event (no-op if gtag is not loaded). */
export function trackEvent(
  name: string,
  params?: Record<string, AnalyticsParam>,
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }
  window.gtag('event', name, params);
}

/** SPA page view after App Router navigations. */
export function trackPageView(path: string, measurementId: string): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }
  window.gtag('config', measurementId, {
    page_path: path,
  });
}

/** Named product events — keep keys stable for GA4 reports. */
export const AnalyticsEvents = {
  signUp: 'sign_up',
  login: 'login',
  createProject: 'create_project',
  verificationRequest: 'verification_request_submitted',
  startClarification: 'start_clarification',
  submitClarificationQuestions: 'submit_clarification_questions',
  submitCommercialProposal: 'submit_commercial_proposal',
  publishForClarification: 'publish_for_clarification',
  publishForBids: 'publish_for_bids',
  openTenderForBids: 'open_tender_for_bids',
  selectContractor: 'select_contractor',
  contractSignatureRequest: 'contract_signature_request_submitted',
  contractSignatureApproved: 'contract_signature_request_approved',
  contractSignatureRejected: 'contract_signature_request_rejected',
  contractPartySigned: 'contract_party_signed',
  contractFullySigned: 'contract_fully_signed',
  contractAddendumSigned: 'contract_addendum_signed',
  hideProject: 'hide_project',
  unhideProject: 'unhide_project',
  requestProjectCompletion: 'request_project_completion',
  confirmProjectCompletion: 'confirm_project_completion',
} as const;

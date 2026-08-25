export const MATCHING_PROJECT_EMAILS_DAILY_CAP = 3;

export interface NotificationPreferencesDto {
  emailEnabled: boolean;
  emailClientBidActivity: boolean;
  emailContractorUpdates: boolean;
  emailMatchingProjects: boolean;
}

export interface UpdateNotificationPreferencesDto {
  emailEnabled?: boolean;
  emailClientBidActivity?: boolean;
  emailContractorUpdates?: boolean;
  emailMatchingProjects?: boolean;
}

export type InAppNotificationKindDto =
  | 'client_bid_submitted'
  | 'client_bid_enrolled'
  | 'client_clarification_questions'
  | 'client_bid_message'
  | 'client_tender_deadline_reached'
  | 'client_contractor_declined_proposal'
  | 'contractor_counter_offer'
  | 'contractor_bid_selected'
  | 'contract_terms_updated'
  | 'contract_party_signed'
  | 'contract_fully_signed'
  | 'contract_addendum_created'
  | 'contract_addendum_party_signed'
  | 'contract_addendum_fully_signed'
  | 'admin_signature_request_created'
  | 'contractor_signature_request_approved'
  | 'contractor_signature_request_rejected'
  | 'client_progress_claim_submitted'
  | 'contractor_progress_claim_approved'
  | 'contractor_progress_claim_rejected'
  | 'contractor_advance_payment_slip_attached'
  | 'contractor_progress_claim_payment_slip_attached'
  | 'contractor_defect_reported'
  | 'contractor_defect_resubmitted'
  | 'contractor_defect_completion_rejected'
  | 'contractor_defect_closed'
  | 'client_defect_declined'
  | 'client_defect_accepted'
  | 'client_defect_completed'
  | 'client_project_completion_requested'
  | 'contractor_project_completion_requested'
  | 'client_project_completion_confirmed'
  | 'contractor_project_completion_confirmed';

export interface InAppNotificationDto {
  id: string;
  kind: InAppNotificationKindDto;
  href: string | null;
  projectId: string | null;
  payload: Record<string, string | number | null> | null;
  readAt: string | null;
  createdAt: string;
}

export interface InAppNotificationsListDto {
  notifications: InAppNotificationDto[];
  unreadCount: number;
}

export interface MarkInAppNotificationsReadDto {
  ids?: string[];
}

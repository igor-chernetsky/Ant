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
  | 'client_tender_deadline_reached'
  | 'client_contractor_declined_proposal'
  | 'contractor_counter_offer'
  | 'contractor_bid_selected'
  | 'contract_terms_updated'
  | 'contract_party_signed'
  | 'contract_fully_signed';

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

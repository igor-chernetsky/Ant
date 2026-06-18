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

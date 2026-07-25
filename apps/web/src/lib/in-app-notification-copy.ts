import type { TranslateFn } from '@/lib/i18n/formatters';
import type { InAppNotification } from '@/lib/in-app-notifications';

function payloadString(
  payload: InAppNotification['payload'],
  key: string,
): string {
  const value = payload?.[key];
  return value == null ? '' : String(value);
}

export function formatInAppNotificationTitle(
  t: TranslateFn,
  item: InAppNotification,
): string {
  switch (item.kind) {
    case 'client_bid_submitted':
      return t('notifications.kinds.clientBidSubmittedTitle');
    case 'client_bid_enrolled':
      return t('notifications.kinds.clientBidEnrolledTitle');
    case 'client_clarification_questions':
      return t('notifications.kinds.clientClarificationQuestionsTitle');
    case 'client_bid_message':
      return t('notifications.kinds.clientBidMessageTitle');
    case 'client_tender_deadline_reached':
      return t('notifications.kinds.clientTenderDeadlineTitle');
    case 'client_contractor_declined_proposal':
      return t('notifications.kinds.clientDeclinedProposalTitle');
    case 'contractor_counter_offer':
      return t('notifications.kinds.contractorCounterOfferTitle');
    case 'contractor_bid_selected':
      return t('notifications.kinds.contractorBidSelectedTitle');
    case 'contract_terms_updated':
      return t('notifications.kinds.contractTermsUpdatedTitle');
    case 'contract_party_signed':
      return t('notifications.kinds.contractPartySignedTitle');
    case 'contract_fully_signed':
      return t('notifications.kinds.contractFullySignedTitle');
    default:
      return t('notifications.title');
  }
}

export function formatInAppNotificationBody(
  t: TranslateFn,
  item: InAppNotification,
): string {
  const projectTitle = payloadString(item.payload, 'projectTitle');
  const companyName = payloadString(item.payload, 'companyName');
  const amount = payloadString(item.payload, 'amount');
  const questionCount = payloadString(item.payload, 'questionCount');
  const preview = payloadString(item.payload, 'preview');

  switch (item.kind) {
    case 'client_bid_submitted':
      return t('notifications.kinds.clientBidSubmittedBody', {
        company: companyName || t('header.contractor'),
        project: projectTitle || t('common.dash'),
        amount: amount || t('common.dash'),
      });
    case 'client_bid_enrolled':
      return t('notifications.kinds.clientBidEnrolledBody', {
        company: companyName || t('header.contractor'),
        project: projectTitle || t('common.dash'),
        n: payloadString(item.payload, 'contenderNumber') || '—',
      });
    case 'client_clarification_questions':
      return t('notifications.kinds.clientClarificationQuestionsBody', {
        company: companyName || t('header.contractor'),
        project: projectTitle || t('common.dash'),
        count: questionCount || '0',
      });
    case 'client_bid_message':
      return t('notifications.kinds.clientBidMessageBody', {
        project: projectTitle || t('common.dash'),
        preview: preview || t('common.dash'),
      });
    case 'client_tender_deadline_reached':
      return t('notifications.kinds.clientTenderDeadlineBody', {
        project: projectTitle || t('common.dash'),
      });
    case 'client_contractor_declined_proposal':
      return t('notifications.kinds.clientDeclinedProposalBody', {
        company: companyName || t('header.contractor'),
        project: projectTitle || t('common.dash'),
      });
    default:
      return projectTitle
        ? t('notifications.kinds.genericProjectBody', { project: projectTitle })
        : '';
  }
}

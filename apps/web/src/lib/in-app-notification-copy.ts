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
    case 'contract_addendum_created':
      return t('notifications.kinds.contractAddendumCreatedTitle');
    case 'contract_addendum_party_signed':
      return t('notifications.kinds.contractAddendumPartySignedTitle');
    case 'contract_addendum_fully_signed':
      return t('notifications.kinds.contractAddendumFullySignedTitle');
    case 'admin_signature_request_created':
      return t('notifications.kinds.adminSignatureRequestCreatedTitle');
    case 'contractor_signature_request_approved':
      return t('notifications.kinds.contractorSignatureRequestApprovedTitle');
    case 'contractor_signature_request_rejected':
      return t('notifications.kinds.contractorSignatureRequestRejectedTitle');
    case 'client_progress_claim_submitted':
      return t('notifications.kinds.clientProgressClaimSubmittedTitle');
    case 'contractor_progress_claim_approved':
      return t('notifications.kinds.contractorProgressClaimApprovedTitle');
    case 'contractor_progress_claim_rejected':
      return t('notifications.kinds.contractorProgressClaimRejectedTitle');
    case 'contractor_advance_payment_slip_attached':
      return t('notifications.kinds.contractorAdvancePaymentSlipAttachedTitle');
    case 'contractor_progress_claim_payment_slip_attached':
      return t('notifications.kinds.contractorProgressClaimPaymentSlipAttachedTitle');
    case 'contractor_defect_reported':
      return t('notifications.kinds.contractorDefectReportedTitle');
    case 'contractor_defect_resubmitted':
      return t('notifications.kinds.contractorDefectResubmittedTitle');
    case 'contractor_defect_completion_rejected':
      return t('notifications.kinds.contractorDefectCompletionRejectedTitle');
    case 'contractor_defect_closed':
      return t('notifications.kinds.contractorDefectClosedTitle');
    case 'client_defect_declined':
      return t('notifications.kinds.clientDefectDeclinedTitle');
    case 'client_defect_accepted':
      return t('notifications.kinds.clientDefectAcceptedTitle');
    case 'client_defect_completed':
      return t('notifications.kinds.clientDefectCompletedTitle');
    case 'client_project_completion_requested':
      return t('notifications.kinds.clientProjectCompletionRequestedTitle');
    case 'contractor_project_completion_requested':
      return t('notifications.kinds.contractorProjectCompletionRequestedTitle');
    case 'client_project_completion_confirmed':
      return t('notifications.kinds.clientProjectCompletionConfirmedTitle');
    case 'contractor_project_completion_confirmed':
      return t('notifications.kinds.contractorProjectCompletionConfirmedTitle');
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
    case 'contract_terms_updated':
      return payloadString(item.payload, 'changeKind') === 'custom_file'
        ? t('notifications.kinds.contractCustomFileUpdatedBody', {
            project: projectTitle || t('common.dash'),
          })
        : t('notifications.kinds.contractTermsUpdatedBody', {
            project: projectTitle || t('common.dash'),
          });
    case 'contract_addendum_created':
      return t('notifications.kinds.contractAddendumCreatedBody', {
        project: projectTitle || t('common.dash'),
        addendum:
          payloadString(item.payload, 'addendumTitle') || t('common.dash'),
      });
    case 'contract_addendum_party_signed':
      return t('notifications.kinds.contractAddendumPartySignedBody', {
        project: projectTitle || t('common.dash'),
        addendum:
          payloadString(item.payload, 'addendumTitle') || t('common.dash'),
      });
    case 'contract_addendum_fully_signed':
      return t('notifications.kinds.contractAddendumFullySignedBody', {
        project: projectTitle || t('common.dash'),
        addendum:
          payloadString(item.payload, 'addendumTitle') || t('common.dash'),
      });
    case 'admin_signature_request_created':
      return t('notifications.kinds.adminSignatureRequestCreatedBody', {
        company: companyName || t('header.contractor'),
        project: projectTitle || t('common.dash'),
      });
    case 'contractor_signature_request_approved':
      return t('notifications.kinds.contractorSignatureRequestApprovedBody', {
        project: projectTitle || t('common.dash'),
      });
    case 'contractor_signature_request_rejected':
      return t('notifications.kinds.contractorSignatureRequestRejectedBody', {
        project: projectTitle || t('common.dash'),
      });
    case 'client_progress_claim_submitted':
      return t('notifications.kinds.clientProgressClaimSubmittedBody', {
        company: companyName || t('header.contractor'),
        project: projectTitle || t('common.dash'),
        amount: amount || t('common.dash'),
        n: payloadString(item.payload, 'sequenceNumber') || '—',
      });
    case 'contractor_progress_claim_approved':
      return t('notifications.kinds.contractorProgressClaimApprovedBody', {
        project: projectTitle || t('common.dash'),
        amount: amount || t('common.dash'),
        n: payloadString(item.payload, 'sequenceNumber') || '—',
      });
    case 'contractor_progress_claim_rejected':
      return t('notifications.kinds.contractorProgressClaimRejectedBody', {
        project: projectTitle || t('common.dash'),
        n: payloadString(item.payload, 'sequenceNumber') || '—',
      });
    case 'contractor_advance_payment_slip_attached':
      return t('notifications.kinds.contractorAdvancePaymentSlipAttachedBody', {
        project: projectTitle || t('common.dash'),
        amount: amount || t('common.dash'),
        count: payloadString(item.payload, 'slipCount') || '1',
      });
    case 'contractor_progress_claim_payment_slip_attached':
      return t('notifications.kinds.contractorProgressClaimPaymentSlipAttachedBody', {
        project: projectTitle || t('common.dash'),
        amount: amount || t('common.dash'),
        n: payloadString(item.payload, 'sequenceNumber') || '—',
        count: payloadString(item.payload, 'slipCount') || '1',
      });
    case 'contractor_defect_reported':
      return t('notifications.kinds.contractorDefectReportedBody', {
        project: projectTitle || t('common.dash'),
        n: payloadString(item.payload, 'defectNumber') || '—',
      });
    case 'contractor_defect_resubmitted':
      return t('notifications.kinds.contractorDefectResubmittedBody', {
        project: projectTitle || t('common.dash'),
        n: payloadString(item.payload, 'defectNumber') || '—',
      });
    case 'contractor_defect_completion_rejected':
      return t('notifications.kinds.contractorDefectCompletionRejectedBody', {
        project: projectTitle || t('common.dash'),
        n: payloadString(item.payload, 'defectNumber') || '—',
      });
    case 'contractor_defect_closed':
      return t('notifications.kinds.contractorDefectClosedBody', {
        project: projectTitle || t('common.dash'),
        n: payloadString(item.payload, 'defectNumber') || '—',
      });
    case 'client_defect_declined':
      return t('notifications.kinds.clientDefectDeclinedBody', {
        project: projectTitle || t('common.dash'),
        n: payloadString(item.payload, 'defectNumber') || '—',
      });
    case 'client_defect_accepted':
      return t('notifications.kinds.clientDefectAcceptedBody', {
        project: projectTitle || t('common.dash'),
        n: payloadString(item.payload, 'defectNumber') || '—',
      });
    case 'client_defect_completed':
      return t('notifications.kinds.clientDefectCompletedBody', {
        project: projectTitle || t('common.dash'),
        n: payloadString(item.payload, 'defectNumber') || '—',
      });
    case 'client_project_completion_requested':
      return t('notifications.kinds.clientProjectCompletionRequestedBody', {
        project: projectTitle || t('common.dash'),
      });
    case 'contractor_project_completion_requested':
      return t('notifications.kinds.contractorProjectCompletionRequestedBody', {
        project: projectTitle || t('common.dash'),
      });
    case 'client_project_completion_confirmed':
      return t('notifications.kinds.clientProjectCompletionConfirmedBody', {
        project: projectTitle || t('common.dash'),
      });
    case 'contractor_project_completion_confirmed':
      return t('notifications.kinds.contractorProjectCompletionConfirmedBody', {
        project: projectTitle || t('common.dash'),
      });
    default:
      return projectTitle
        ? t('notifications.kinds.genericProjectBody', { project: projectTitle })
        : '';
  }
}

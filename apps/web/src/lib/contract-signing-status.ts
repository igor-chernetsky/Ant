import type { ProjectContract } from '@/lib/contracts';

export type ContractSigningVisualStatus =
  | 'awaiting_both'
  | 'awaiting_client'
  | 'awaiting_contractor'
  | 'fully_signed';

export function getContractSigningVisualStatus(
  contract: ProjectContract,
): ContractSigningVisualStatus {
  if (contract.fullySigned) {
    return 'fully_signed';
  }
  if (contract.clientSignedAt && !contract.contractorSignedAt) {
    return 'awaiting_contractor';
  }
  if (!contract.clientSignedAt && contract.contractorSignedAt) {
    return 'awaiting_client';
  }
  return 'awaiting_both';
}

export function getContractSigningHeadline(
  status: ContractSigningVisualStatus,
): string {
  switch (status) {
    case 'fully_signed':
      return 'Contract fully signed';
    case 'awaiting_client':
      return 'Waiting for client signature';
    case 'awaiting_contractor':
      return 'Waiting for contractor signature';
    default:
      return 'Contract awaiting signatures';
  }
}

export function getContractSigningMessage(
  contract: ProjectContract,
  status: ContractSigningVisualStatus,
): string {
  switch (status) {
    case 'fully_signed':
      return 'Both parties have signed. The project is now active.';
    case 'awaiting_client':
      return 'The contractor has signed. The client still needs to sign the contract draft.';
    case 'awaiting_contractor':
      return 'The client has signed. The selected contractor still needs to sign the contract draft.';
    default:
      return 'The client and selected contractor both need to sign the contract draft before work can start.';
  }
}

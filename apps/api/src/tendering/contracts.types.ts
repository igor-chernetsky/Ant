export type ContractStatus = 'pending_signatures' | 'fully_signed';

export interface ContractResponse {
  id: string;
  projectId: string;
  bidId: string;
  status: ContractStatus;
  projectStatus: string;
  clientSignedAt: string | null;
  contractorSignedAt: string | null;
  canSign: boolean;
  fullySigned: boolean;
}

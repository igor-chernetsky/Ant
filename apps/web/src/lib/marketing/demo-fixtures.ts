import type { ProjectContract } from '@/lib/contracts';
import type { Project, ProjectBriefV1, ProjectTag } from '@/lib/projects';
import type { PublicProjectCard } from '@/lib/public-projects';
import type {
  Bid,
  ClarificationQuestion,
  ContractorApplicationItem,
  DefaultCostBreakdownItem,
} from '@/lib/tendering';

export const DEMO_PROJECT_ID = 'demo-villa-renovation';
export const DEMO_TENDER_ID = 'demo-tender-1';

export const demoProjectTags: ProjectTag[] = [
  { slug: 'tiling', label: 'Tiling', source: 'ai', groupSlug: 'finishes' },
  { slug: 'plumbing', label: 'Plumbing', source: 'ai', groupSlug: 'mep' },
  { slug: 'joinery', label: 'Joinery', source: 'client', groupSlug: 'finishes' },
  { slug: 'electrical', label: 'Electrical', source: 'ai', groupSlug: 'mep' },
];

export const demoBrief: ProjectBriefV1 = {
  schemaVersion: 1,
  summary:
    '180 sqm pool villa refresh: new kitchen, three ensuite upgrades, landscaping, and MEP updates.',
  property: { areaSqm: 180, floors: 2, rooms: 4 },
  design: { hasPlans: true, needsDesignTender: false },
  constraints: 'Work during low season; noise limits 08:00–18:00.',
  ai: { missingFields: ['electrical_panel_photo'] },
  packages: [
    {
      trade: 'Kitchen',
      description: 'Full kitchen replacement incl. cabinetry and stone tops',
      areaSqm: 18,
    },
    {
      trade: 'Tiling',
      description: 'Floor and wet-area tiling from plans sheet A-02',
      areaSqm: 95,
    },
  ],
};

export const demoProject: Project = {
  id: DEMO_PROJECT_ID,
  title: 'Pool villa renovation — Bang Tao',
  description:
    'Full interior refresh, kitchen, three bathrooms, landscaping, and pool deck repairs.',
  projectType: 'repair',
  propertyType: 'residential',
  district: 'Cherng Talay, Phuket',
  locationRegionSlug: '',
  locationAreaSlug: null,
  locationNote: null,
  regionCode: 'TH-83',
  status: 'in_tender',
  isHidden: false,
  readinessScore: 78,
  brief: demoBrief,
  clarificationMode: 'structured_qa',
  clarificationSummary:
    'Client confirmed tile spec, kitchen layout, and phased access for occupied rooms.',
  scopeSummary: 'Turnkey interior refresh with wet-area waterproofing and landscaping.',
  tags: demoProjectTags,
  estimate: {
    id: 'demo-estimate-1',
    projectId: DEMO_PROJECT_ID,
    type: 'ballpark',
    currency: 'THB',
    totals: {
      minAmount: 2_800_000,
      maxAmount: 3_400_000,
      midAmount: 3_100_000,
      currency: 'THB',
    },
    lines: [],
    confidence: 0.72,
    disclaimer: '',
    createdAt: '2026-07-01T10:00:00Z',
  },
  createdAt: '2026-06-15T08:00:00Z',
  updatedAt: '2026-08-01T10:00:00Z',
};

export const demoOwnedProjectTile: PublicProjectCard = {
  id: DEMO_PROJECT_ID,
  title: demoProject.title,
  description: demoProject.description,
  projectType: demoProject.projectType,
  district: demoProject.district,
  regionCode: demoProject.regionCode,
  status: demoProject.status,
  isHidden: false,
  readinessScore: demoProject.readinessScore,
  tags: demoProjectTags.map(({ slug, label }) => ({ slug, label })),
  coverImageUrl: null,
  updatedAt: demoProject.updatedAt,
  canOpenDetail: true,
  estimate: {
    minAmount: 2_800_000,
    maxAmount: 3_400_000,
    midAmount: 3_100_000,
    currency: 'THB',
    confidence: 0.72,
  },
};

export const demoMarketplaceTiles: PublicProjectCard[] = [
  demoOwnedProjectTile,
  {
    id: 'demo-condo-fitout',
    title: 'Condo fit-out — Sukhumvit',
    description: 'Two-bedroom renovation with built-in joinery and lighting package.',
    projectType: 'commercial_fitout',
    district: 'Watthana, Bangkok',
    regionCode: 'TH-10',
    status: 'in_tender',
    isHidden: false,
    readinessScore: 65,
    tags: [
      { slug: 'joinery', label: 'Joinery' },
      { slug: 'electrical', label: 'Electrical' },
    ],
    coverImageUrl: null,
    updatedAt: '2026-07-28T09:00:00Z',
    canOpenDetail: true,
  },
  {
    id: 'demo-resort-extension',
    title: 'Resort wing extension — Krabi',
    description: 'New guest wing shell, MEP rough-in, and pool deck extension.',
    projectType: 'extension',
    district: 'Ao Nang, Krabi',
    regionCode: 'TH-81',
    status: 'estimated',
    isHidden: false,
    readinessScore: 54,
    tags: [
      { slug: 'structural', label: 'Structural' },
      { slug: 'plumbing', label: 'Plumbing' },
    ],
    coverImageUrl: null,
    updatedAt: '2026-07-25T12:00:00Z',
    canOpenDetail: true,
  },
];

export const demoClarificationQuestions: ClarificationQuestion[] = [
  {
    id: 'demo-q1',
    questionText: 'Which tile collection should be used for wet areas?',
    sortOrder: 1,
    answer: 'Porcelanosa Dover Acero 600×600 — supply by client, install by contractor.',
    answeredAt: '2026-07-12T11:30:00Z',
    sourceBidIds: ['demo-bid-a', 'demo-bid-b'],
    askedByCount: 2,
    attachments: [],
    createdAt: '2026-07-10T09:00:00Z',
    updatedAt: '2026-07-12T11:30:00Z',
  },
  {
    id: 'demo-q2',
    questionText: 'Can kitchen work proceed while the villa is occupied?',
    sortOrder: 2,
    answer: 'Yes — kitchen first, then phased bathroom work with dust barriers.',
    answeredAt: '2026-07-13T08:15:00Z',
    sourceBidIds: ['demo-bid-a'],
    askedByCount: 1,
    attachments: [],
    createdAt: '2026-07-11T10:00:00Z',
    updatedAt: '2026-07-13T08:15:00Z',
  },
  {
    id: 'demo-q3',
    questionText: 'Is the existing electrical panel sufficient for added AC loads?',
    sortOrder: 3,
    answer: null,
    answeredAt: null,
    sourceBidIds: ['demo-bid-c'],
    askedByCount: 1,
    attachments: [],
    createdAt: '2026-07-14T14:00:00Z',
    updatedAt: '2026-07-14T14:00:00Z',
  },
];

export const demoBids: Bid[] = [
  {
    id: 'demo-bid-a',
    tenderId: DEMO_TENDER_ID,
    contractorId: 'demo-c1',
    companyName: 'Andaman Build Co.',
    status: 'submitted',
    contenderNumber: 1,
    enrolledAt: '2026-07-10T09:00:00Z',
    submittedAt: '2026-07-20T14:00:00Z',
    amount: '3250000',
    durationDays: 95,
    contractorProposalCount: 1,
    terms: {
      scopeSummary: 'Turnkey fit-out incl. MEP rough-in, tiling, joinery, and landscaping.',
      notes: 'Phased access plan included. Client-supplied tiles and sanitary ware excluded.',
      contractTerms: {
        worksStartDate: '2026-09-01',
        worksFinishDate: '2026-12-05',
      },
      costAdjustments: {
        worksSubtotal: 2_900_000,
        preliminaryPercent: 5,
        preliminaryAmount: 145_000,
        overheadProfitPercent: 10,
        overheadProfitAmount: 290_000,
        vatPercent: 7,
        vatAmount: 227_500,
      },
      lineItems: [
        { trade: 'Demolition', amount: 180_000 },
        { trade: 'Tiling', description: 'Floor & wet areas', amount: 420_000 },
        { trade: 'Joinery', amount: 680_000 },
        { trade: 'MEP', amount: 520_000 },
      ],
    },
  },
  {
    id: 'demo-bid-b',
    tenderId: DEMO_TENDER_ID,
    contractorId: 'demo-c2',
    companyName: 'Phuket Renovations Ltd.',
    status: 'submitted',
    contenderNumber: 2,
    enrolledAt: '2026-07-11T11:00:00Z',
    submittedAt: '2026-07-22T10:00:00Z',
    amount: '2980000',
    durationDays: 88,
    contractorProposalCount: 2,
    terms: {
      scopeSummary: 'Interior works package; landscaping quoted separately.',
      notes: 'Pool deck structural repairs excluded from this proposal.',
      contractTerms: {
        worksStartDate: '2026-09-15',
        worksFinishDate: '2026-12-12',
      },
      costAdjustments: {
        worksSubtotal: 2_650_000,
        preliminaryPercent: 5,
        preliminaryAmount: 132_500,
        overheadProfitPercent: 8,
        overheadProfitAmount: 212_000,
        vatPercent: 7,
        vatAmount: 185_500,
      },
      lineItems: [
        { trade: 'Demolition', amount: 150_000 },
        { trade: 'Tiling', amount: 390_000 },
        { trade: 'Joinery', amount: 610_000 },
      ],
    },
  },
  {
    id: 'demo-bid-c',
    tenderId: DEMO_TENDER_ID,
    contractorId: 'demo-c3',
    companyName: 'Island Craft Studio',
    status: 'submitted',
    contenderNumber: 3,
    enrolledAt: '2026-07-12T08:00:00Z',
    submittedAt: '2026-07-23T16:00:00Z',
    amount: '3420000',
    durationDays: 102,
    contractorProposalCount: 1,
    terms: {
      scopeSummary: 'Premium joinery-led package with extended warranty.',
      contractTerms: {
        worksStartDate: '2026-09-01',
        worksFinishDate: '2026-12-20',
      },
      costAdjustments: {
        worksSubtotal: 3_050_000,
        preliminaryPercent: 5,
        preliminaryAmount: 152_500,
        overheadProfitPercent: 12,
        overheadProfitAmount: 366_000,
        vatPercent: 7,
        vatAmount: 213_500,
      },
      lineItems: [
        { trade: 'Joinery', amount: 920_000 },
        { trade: 'Tiling', amount: 450_000 },
        { trade: 'MEP', amount: 580_000 },
      ],
    },
  },
];

export const demoCompareBreakdown: DefaultCostBreakdownItem[] = [
  { trade: 'Demolition' },
  { trade: 'Tiling' },
  { trade: 'Joinery' },
  { trade: 'MEP' },
];

export const demoContractAwaitingContractor: ProjectContract = {
  id: 'demo-contract-1',
  projectId: DEMO_PROJECT_ID,
  bidId: 'demo-bid-a',
  status: 'pending_signatures',
  projectStatus: 'awarded',
  clientSignedAt: '2026-08-05T11:00:00Z',
  contractorSignedAt: null,
  hasClientSignature: true,
  hasContractorSignature: false,
  clientSignatureDataUrl: null,
  contractorSignatureDataUrl: null,
  englishBodyHtml: null,
  hasCustomContract: false,
  customFile: null,
  canSign: false,
  canEditDocument: false,
  fullySigned: false,
  signatureAuth: null,
};

export const demoContractFullySigned: ProjectContract = {
  ...demoContractAwaitingContractor,
  contractorSignedAt: '2026-08-06T09:30:00Z',
  hasContractorSignature: true,
  fullySigned: true,
  status: 'fully_signed',
  projectStatus: 'active',
};

export const demoContractorApplication: ContractorApplicationItem = {
  bidId: 'demo-bid-a',
  tenderId: DEMO_TENDER_ID,
  projectId: DEMO_PROJECT_ID,
  projectTitle: demoProject.title,
  projectDistrict: 'Cherng Talay',
  projectStatus: 'in_tender',
  projectType: 'repair',
  description: 'Published 3 days ago · structured Q&A complete',
  coverImageUrl: null,
  tenderStatus: 'open',
  bidStatus: 'submitted',
  contenderNumber: 2,
  bidAmount: '3250000',
  submittedAt: '2026-07-20T14:00:00Z',
  isActiveProject: false,
};

export const demoContractorApplications: ContractorApplicationItem[] = [
  demoContractorApplication,
  {
    bidId: 'demo-bid-enrolled',
    tenderId: 'demo-tender-2',
    projectId: 'demo-condo-fitout',
    projectTitle: 'Condo fit-out — Sukhumvit',
    projectDistrict: 'Watthana',
    projectStatus: 'in_tender',
    projectType: 'commercial_fitout',
    description: 'Enrolled yesterday',
    coverImageUrl: null,
    tenderStatus: 'open',
    bidStatus: 'enrolled',
    contenderNumber: 4,
    bidAmount: null,
    submittedAt: null,
    isActiveProject: false,
  },
];

export const demoTenderMeta = {
  status: 'open' as const,
  applicationsCount: 3,
  proposalsCount: 3,
  closesAt: '2026-08-30T17:00:00Z',
  noApplicationsDeadline: false,
};

export const demoDocuments = [
  {
    id: 'demo-doc-1',
    fileName: 'Floor-plans-A02.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2_450_000,
    uploadedAt: '2026-06-20T10:00:00Z',
  },
  {
    id: 'demo-doc-2',
    fileName: 'Kitchen-moodboard.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 890_000,
    uploadedAt: '2026-06-21T14:00:00Z',
  },
];

export const demoContractorProfilePreview = {
  companyName: 'Andaman Build Co.',
  verificationStatus: 'verified' as const,
  serviceAreas: ['Phuket', 'Phang Nga'],
  projectTypes: ['repair', 'renovation', 'commercial_fitout'],
  tagSlugs: ['tiling', 'joinery', 'plumbing'],
  documentsCount: 4,
  portfolioCount: 6,
};

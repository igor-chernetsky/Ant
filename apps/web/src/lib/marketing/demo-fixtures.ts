import type { ProjectContract } from '@/lib/contracts';
import type { Project, ProjectBriefV1, ProjectTag } from '@/lib/projects';
import type { PublicProjectCard } from '@/lib/public-projects';
import type {
  Bid,
  ClarificationQuestion,
  ContractorApplicationItem,
  DefaultCostBreakdownItem,
} from '@/lib/tendering';

export const DEMO_PROJECT_ID = 'demo-hotel-boh';
export const DEMO_TENDER_ID = 'demo-tender-1';
export const DEMO_ESTIMATE_BEFORE_MID = 4_200_000;
export const DEMO_ESTIMATE_AFTER_MID = 5_100_000;

export const demoProjectTags: ProjectTag[] = [
  { slug: 'joinery', label: 'Joinery', source: 'client', groupSlug: 'finishes' },
  { slug: 'hvac', label: 'HVAC', source: 'ai', groupSlug: 'mep' },
  { slug: 'plumbing', label: 'Plumbing', source: 'ai', groupSlug: 'mep' },
  { slug: 'electrical', label: 'Electrical', source: 'ai', groupSlug: 'mep' },
];

export const demoBrief: ProjectBriefV1 = {
  schemaVersion: 1,
  summary:
    'Back-of-house refresh for a 4-star Bangkok hotel: commercial kitchen, staff areas, MEP, and wet-area finishes.',
  property: { areaSqm: 420, floors: 2, rooms: 18 },
  design: { hasPlans: true, needsDesignTender: false },
  constraints: 'Live hotel operations; noisy works 22:00–06:00 only.',
  ai: { missingFields: ['kitchen_equipment_schedule'] },
  packages: [
    {
      trade: 'Kitchen',
      description: 'Commercial kitchen replacement incl. extraction and cold rooms',
      areaSqm: 85,
    },
    {
      trade: 'MEP',
      description: 'HVAC, plumbing and electrical from plans sheet M-01',
      areaSqm: 420,
    },
  ],
};

export const demoEstimateLines = [
  {
    trade: 'Kitchen',
    description: 'Commercial kitchen fit-out',
    quantity: 85,
    unit: 'sqm',
    unitPriceMin: 8_200,
    unitPriceMax: 11_400,
    lineMin: 697_000,
    lineMax: 969_000,
  },
  {
    trade: 'HVAC',
    description: 'Extraction and staff-area AC',
    quantity: 1,
    unit: 'ls',
    unitPriceMin: 620_000,
    unitPriceMax: 840_000,
    lineMin: 620_000,
    lineMax: 840_000,
  },
  {
    trade: 'Plumbing',
    description: 'Kitchen and wet-area plumbing',
    quantity: 1,
    unit: 'ls',
    unitPriceMin: 410_000,
    unitPriceMax: 560_000,
    lineMin: 410_000,
    lineMax: 560_000,
  },
  {
    trade: 'Electrical',
    description: 'Power and lighting for BOH',
    quantity: 1,
    unit: 'ls',
    unitPriceMin: 380_000,
    unitPriceMax: 510_000,
    lineMin: 380_000,
    lineMax: 510_000,
  },
  {
    trade: 'Finishes',
    description: 'Floors, walls and wet-area tiling',
    quantity: 220,
    unit: 'sqm',
    unitPriceMin: 2_400,
    unitPriceMax: 3_200,
    lineMin: 528_000,
    lineMax: 704_000,
  },
];

export const demoProject: Project = {
  id: DEMO_PROJECT_ID,
  title: 'Hotel Bangkok back of house renovation',
  description:
    'Commercial kitchen, staff areas, MEP upgrades and wet-area finishes while the hotel stays in operation.',
  projectType: 'commercial_fitout',
  propertyType: 'commercial',
  district: 'Sathorn, Bangkok',
  locationRegionSlug: 'bangkok',
  locationAreaSlug: 'sathorn',
  locationNote: null,
  regionCode: 'TH-10',
  status: 'in_tender',
  isHidden: false,
  readinessScore: 80,
  brief: demoBrief,
  clarificationMode: 'structured_qa',
  clarificationSummary:
    'Client confirmed kitchen replacement, night-work window, and phased staff-area access.',
  scopeSummary: 'Turnkey back-of-house fit-out with kitchen replacement and MEP.',
  tags: demoProjectTags,
  estimate: {
    id: 'demo-estimate-1',
    projectId: DEMO_PROJECT_ID,
    type: 'ballpark',
    currency: 'THB',
    totals: {
      minAmount: 4_200_000,
      maxAmount: 5_100_000,
      midAmount: DEMO_ESTIMATE_AFTER_MID,
      currency: 'THB',
    },
    lines: demoEstimateLines,
    confidence: 0.8,
    disclaimer: '',
    improvementQuestions: [
      'Will the existing commercial kitchen be renovated or replaced?',
    ],
    refinementAnswers: [
      {
        question: 'Will the existing commercial kitchen be renovated or replaced?',
        answer: 'Replace',
        answeredAt: '2026-07-08T10:00:00Z',
      },
    ],
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
    minAmount: 4_200_000,
    maxAmount: 5_100_000,
    midAmount: DEMO_ESTIMATE_AFTER_MID,
    currency: 'THB',
    confidence: 0.8,
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
    questionText: 'Which commercial kitchen equipment stays owner-supplied?',
    sortOrder: 1,
    answer: 'Cooking line and cold rooms by owner; extraction and services by contractor.',
    answeredAt: '2026-07-12T11:30:00Z',
    sourceBidIds: ['demo-bid-a', 'demo-bid-b'],
    askedByCount: 2,
    attachments: [],
    createdAt: '2026-07-10T09:00:00Z',
    updatedAt: '2026-07-12T11:30:00Z',
  },
  {
    id: 'demo-q2',
    questionText: 'Can kitchen strip-out proceed while the hotel is occupied?',
    sortOrder: 2,
    answer: 'Yes — night shift only, with a temporary staff kitchen on level B1.',
    answeredAt: '2026-07-13T08:15:00Z',
    sourceBidIds: ['demo-bid-a'],
    askedByCount: 1,
    attachments: [],
    createdAt: '2026-07-11T10:00:00Z',
    updatedAt: '2026-07-13T08:15:00Z',
  },
  {
    id: 'demo-q3',
    questionText: 'Is the existing electrical capacity enough for the new kitchen load?',
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
      scopeSummary: 'Turnkey BOH fit-out incl. kitchen replacement, MEP, and wet-area finishes.',
      notes: 'Night-work plan included. Owner-supplied kitchen equipment excluded.',
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
      notes: 'Staff-area ceiling replacement excluded from this proposal.',
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
  projectDistrict: 'Sathorn',
  projectStatus: 'in_tender',
  projectType: 'commercial_fitout',
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
    fileName: 'Floor-plans-BOH.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2_450_000,
    uploadedAt: '2026-06-20T10:00:00Z',
  },
  {
    id: 'demo-doc-2',
    fileName: 'Kitchen-interior-photos.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 890_000,
    uploadedAt: '2026-06-21T14:00:00Z',
  },
  {
    id: 'demo-doc-3',
    fileName: 'MEP-specifications.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1_120_000,
    uploadedAt: '2026-06-22T09:00:00Z',
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

export const demoProgressPreviewLines = [
  {
    trade: 'Kitchen',
    contractAmount: 1_850_000,
    percentComplete: 72,
    worksPeriod: 420_000,
    retentionPeriod: 21_000,
    payablePeriod: 399_000,
  },
  {
    trade: 'MEP',
    contractAmount: 980_000,
    percentComplete: 55,
    worksPeriod: 215_000,
    retentionPeriod: 10_750,
    payablePeriod: 204_250,
  },
  {
    trade: 'Finishes',
    contractAmount: 640_000,
    percentComplete: 40,
    worksPeriod: 96_000,
    retentionPeriod: 4_800,
    payablePeriod: 91_200,
  },
];

export const demoContractorReviewPreview = {
  averageRating: 4.6,
  reviewCount: 3,
  projectType: 'commercial_fitout',
  district: 'Sathorn',
  completedAt: '2025-11-14T10:30:00.000Z',
  comment:
    'Kitchen and MEP phases stayed on schedule. Site was kept clean during live hotel operations.',
  ratings: {
    quality: 5,
    timeline: 4,
    communication: 5,
    professionalism: 5,
    value: 4,
    siteConduct: 5,
  },
};

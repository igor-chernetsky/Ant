import {
  ProjectType,
  PropertyType,
  TagSource,
} from '@prisma/client';

export interface ProjectBriefV1 {
  schemaVersion: 1;
  summary?: string;
  packages?: Array<{
    trade: string;
    description: string;
    quantity?: number;
    unit?: string;
    areaSqm?: number;
  }>;
  property?: {
    type?: PropertyType;
    areaSqm?: number;
    floors?: number;
    rooms?: number;
  };
  materials?: {
    suppliedBy?: 'client' | 'contractor' | 'mixed';
    tier?: 'economy' | 'standard' | 'premium';
  };
  timeline?: {
    desiredStart?: string;
    flexibility?: 'flexible' | 'fixed';
  };
  design?: {
    hasPlans?: boolean;
    needsDesignTender?: boolean;
  };
  constraints?: string;
  ai?: {
    missingFields?: string[];
    confidence?: number;
    originalNarrative?: string;
  };
}

export function slugifyTagLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

export function buildInitialBrief(input: {
  description?: string | null;
  propertyType?: PropertyType | null;
  originalNarrative?: string;
}): ProjectBriefV1 {
  const missingFields: string[] = [];
  if (!input.description?.trim()) {
    missingFields.push('summary');
  }
  if (!input.propertyType) {
    missingFields.push('property.type');
  }

  return {
    schemaVersion: 1,
    summary: input.description?.trim() ?? '',
    packages: [],
    property: input.propertyType ? { type: input.propertyType } : {},
    materials: {},
    timeline: {},
    design: { hasPlans: false, needsDesignTender: false },
    ai: {
      missingFields,
      confidence: 0.2,
      originalNarrative: input.originalNarrative ?? input.description ?? '',
    },
  };
}

export function computeReadinessScore(input: {
  title: string;
  description?: string | null;
  projectType: ProjectType;
  propertyType?: PropertyType | null;
  district?: string | null;
  tagCount: number;
  brief: ProjectBriefV1;
}): number {
  let score = 0;

  if (input.title.trim().length >= 3) score += 15;
  if (input.description && input.description.trim().length >= 20) score += 15;
  if (input.projectType !== ProjectType.other) score += 10;
  if (input.propertyType) score += 10;
  if (input.district?.trim()) score += 10;
  if (input.tagCount >= 1) score += 15;
  if (input.tagCount >= 3) score += 5;
  if (input.brief.summary && input.brief.summary.length >= 30) score += 10;
  if ((input.brief.packages?.length ?? 0) >= 1) score += 10;

  return Math.min(100, score);
}

/** Keyword-based MVP suggestion until AI intake is wired. */
export function suggestTagSlugsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/\belectri/, 'electrical'],
    [/\bplumb|\bpipe|\bwater heater/, 'plumbing'],
    [/\broof/, 'roofing'],
    [/\bfinish|\bpaint|\bfloor|\btile/, 'finishing'],
    [/\bdemol/, 'demolition'],
    [/\bstruct|\bbeam|\bfoundation/, 'structural'],
    [/\bhvac|\bair cond|\bac\b/, 'hvac'],
    [/\bpaint/, 'painting'],
    [/\bfloor/, 'flooring'],
    [/\btile/, 'tiling'],
    [/\bcarpent|\bwood|\bcabinet/, 'carpentry'],
    [/\bgarden|\blandscape/, 'landscaping'],
    [/\bwindow|\bdoor/, 'windows-doors'],
    [/\bconcrete/, 'concrete'],
    [/\bbrick|\bmason/, 'masonry'],
    [/\bdesign|\barchitect|\bplan/, 'design'],
    [/\bpermit|\blicense/, 'permits'],
  ];

  const slugs = new Set<string>();
  for (const [pattern, slug] of rules) {
    if (pattern.test(lower)) {
      slugs.add(slug);
    }
  }
  return [...slugs];
}

export { ProjectType, PropertyType, TagSource };

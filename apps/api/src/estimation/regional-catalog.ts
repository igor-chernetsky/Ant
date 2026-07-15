export interface RegionalCatalogItem {
  trade: string;
  label: string;
  unit: string;
  priceMinThb: number;
  priceMaxThb: number;
}

/** MVP regional reference prices (THB) — not a quote, for AI + fallback only. */
export const TH_REGIONAL_CATALOG: RegionalCatalogItem[] = [
  {
    trade: 'demolition',
    label: 'Demolition & strip-out',
    unit: 'sqm',
    priceMinThb: 450,
    priceMaxThb: 900,
  },
  {
    trade: 'electrical',
    label:
      'Electrical works (wiring, boards, lighting fixtures; specialty luminaires at upper band)',
    unit: 'sqm',
    priceMinThb: 2200,
    priceMaxThb: 6500,
  },
  {
    trade: 'plumbing',
    label:
      'Plumbing, water-supply connection & treatment (points + utility tie-in; premium filtration at upper band / extra lump)',
    unit: 'point',
    priceMinThb: 8000,
    priceMaxThb: 28000,
  },
  {
    trade: 'structural',
    label: 'Structural works',
    unit: 'sqm',
    priceMinThb: 2500,
    priceMaxThb: 5500,
  },
  {
    trade: 'roofing',
    label: 'Roofing',
    unit: 'sqm',
    priceMinThb: 1200,
    priceMaxThb: 3500,
  },
  {
    trade: 'finishing',
    label: 'General finishing',
    unit: 'sqm',
    priceMinThb: 1500,
    priceMaxThb: 4500,
  },
  {
    trade: 'painting',
    label: 'Painting',
    unit: 'sqm',
    priceMinThb: 120,
    priceMaxThb: 350,
  },
  {
    trade: 'flooring',
    label: 'Flooring',
    unit: 'sqm',
    priceMinThb: 800,
    priceMaxThb: 3500,
  },
  {
    trade: 'tiling',
    label: 'Tiling',
    unit: 'sqm',
    priceMinThb: 900,
    priceMaxThb: 2800,
  },
  {
    trade: 'carpentry',
    label: 'Carpentry & joinery',
    unit: 'sqm',
    priceMinThb: 2000,
    priceMaxThb: 6000,
  },
  {
    trade: 'hvac',
    label: 'HVAC / air conditioning',
    unit: 'unit',
    priceMinThb: 18000,
    priceMaxThb: 45000,
  },
  {
    trade: 'windows-doors',
    label: 'Windows & doors',
    unit: 'unit',
    priceMinThb: 8000,
    priceMaxThb: 35000,
  },
  {
    trade: 'design',
    label: 'Design & documentation',
    unit: 'lump',
    priceMinThb: 15000,
    priceMaxThb: 80000,
  },
  {
    trade: 'insulation',
    label: 'Insulation',
    unit: 'sqm',
    priceMinThb: 400,
    priceMaxThb: 1200,
  },
  {
    trade: 'landscaping',
    label: 'Landscaping',
    unit: 'sqm',
    priceMinThb: 600,
    priceMaxThb: 2500,
  },
];

export function catalogSummaryForPrompt(
  catalog: RegionalCatalogItem[] = TH_REGIONAL_CATALOG,
): string {
  const rows = catalog
    .map(
      (c) =>
        `${c.trade}: ${c.label} — ${c.priceMinThb}-${c.priceMaxThb} THB/${c.unit}`,
    )
    .join('\n');
  return `${rows}
Notes:
- electrical: lighting fixtures and switchgear push toward mid-high band; specialty / underwater / designer luminaires require upper-band OR a separate electrical lump (often +40k–180k THB), not "free wording" inside a cheap wiring line.
- plumbing: mains water / sewer utility tie-in is substantially more than a single fixture point — treat connection works near the upper band or as an additional lump.
- pool water treatment: chlorine-free / UV / ozone / salt systems must be priced explicitly (typically +80k–250k THB lump on plumbing or a dedicated plumbing line). Do not treat them as zero-cost notes.
- Prefer multiple MEP lines when scope is detailed (e.g. wiring+board, specialty lighting, utility connection, filtration/treatment) rather than one shallow aggregate.`;
}

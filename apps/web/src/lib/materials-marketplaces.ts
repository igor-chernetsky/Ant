export type MaterialCategory =
  | 'structural'
  | 'finishes'
  | 'plumbing'
  | 'electrical'
  | 'kitchen_bath'
  | 'tools'
  | 'roofing'
  | 'paint'
  | 'timber';

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'structural',
  'finishes',
  'plumbing',
  'electrical',
  'kitchen_bath',
  'tools',
  'roofing',
  'paint',
  'timber',
];

export interface MaterialsMarketplace {
  id: string;
  name: string;
  url: string;
  /** i18n key under materials.blurbs.* */
  blurbKey: string;
  categories: MaterialCategory[];
  /**
   * Optional known-good cover image when og:image is missing/broken.
   * Prefer absolute https URLs.
   */
  imageUrl?: string;
}

/**
 * Curated Thai construction-materials retailers / marketplaces.
 * Kept as static data for now — later these can be suggested inside projects.
 */
export const MATERIALS_MARKETPLACES: MaterialsMarketplace[] = [
  {
    id: 'thaiwatsadu',
    name: 'Thai Watsadu',
    url: 'https://www.thaiwatsadu.com/',
    blurbKey: 'thaiwatsadu',
    categories: [
      'structural',
      'finishes',
      'plumbing',
      'electrical',
      'tools',
      'paint',
      'timber',
      'roofing',
    ],
  },
  {
    id: 'homepro',
    name: 'HomePro',
    url: 'https://www.homepro.co.th/',
    blurbKey: 'homepro',
    categories: [
      'finishes',
      'kitchen_bath',
      'plumbing',
      'electrical',
      'tools',
      'paint',
    ],
  },
  {
    id: 'boonthavorn',
    name: 'Boonthavorn',
    url: 'https://boonthavorn.com/',
    blurbKey: 'boonthavorn',
    categories: ['finishes', 'kitchen_bath', 'plumbing', 'paint'],
  },
  {
    id: 'scg-home',
    name: 'SCG HOME',
    url: 'https://www.scghome.com/',
    blurbKey: 'scgHome',
    categories: [
      'structural',
      'roofing',
      'finishes',
      'plumbing',
      'electrical',
      'paint',
    ],
  },
  {
    id: 'global-house',
    name: 'Global House',
    url: 'https://globalhouse.co.th/',
    blurbKey: 'globalHouse',
    categories: [
      'structural',
      'finishes',
      'tools',
      'roofing',
      'timber',
      'paint',
      'plumbing',
      'electrical',
    ],
  },
  {
    id: 'dohome',
    name: 'DoHome',
    url: 'https://www.dohome.co.th/',
    blurbKey: 'dohome',
    categories: [
      'structural',
      'finishes',
      'tools',
      'electrical',
      'timber',
      'paint',
    ],
  },
  {
    id: 'mega-home',
    name: 'Mega Home',
    url: 'https://www.megahome.co.th/',
    blurbKey: 'megaHome',
    imageUrl: 'https://static.homepro.co.th/logo/Logo_mh_line.png',
    categories: [
      'structural',
      'finishes',
      'roofing',
      'tools',
      'plumbing',
      'timber',
    ],
  },
  {
    id: 'rakmao',
    name: 'Rakmao',
    url: 'https://www.rakmao.com/',
    blurbKey: 'rakmao',
    imageUrl:
      'https://storage.googleapis.com/asia.artifacts.cbm-dist-rakmao-rudy-prd.appspot.com/Rakmao-og/logo-rakmao.png',
    categories: ['structural', 'finishes', 'roofing', 'tools'],
  },
];

export function filterMarketplacesByCategory(
  category: MaterialCategory | null,
): MaterialsMarketplace[] {
  if (!category) {
    return MATERIALS_MARKETPLACES;
  }
  return MATERIALS_MARKETPLACES.filter((item) =>
    item.categories.includes(category),
  );
}

export const DEFAULT_LOCATION_REGION_SLUG = 'bangkok';

export interface LocationRegion {
  slug: string;
  label: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export interface LocationArea {
  slug: string;
  label: string;
  regionSlug: string;
  lat: number;
  lng: number;
}

export interface ServiceLocation {
  regionSlug: string;
  areaSlug?: string;
}

export interface ProjectLocation {
  regionSlug: string;
  areaSlug?: string | null;
  note?: string | null;
}

/**
 * Major Thailand construction / real-estate hubs.
 * Existing slugs are preserved so saved projects keep working.
 */
export const LOCATION_REGIONS: LocationRegion[] = [
  { slug: 'bangkok', label: 'Bangkok', countryCode: 'TH', lat: 13.7563, lng: 100.5018 },
  { slug: 'nonthaburi', label: 'Nonthaburi', countryCode: 'TH', lat: 13.8621, lng: 100.5144 },
  { slug: 'samut_prakan', label: 'Samut Prakan', countryCode: 'TH', lat: 13.599, lng: 100.5998 },
  { slug: 'pathum_thani', label: 'Pathum Thani', countryCode: 'TH', lat: 14.0208, lng: 100.525 },
  { slug: 'pattaya', label: 'Pattaya / Chonburi', countryCode: 'TH', lat: 12.9236, lng: 100.8825 },
  { slug: 'rayong', label: 'Rayong', countryCode: 'TH', lat: 12.6833, lng: 101.2372 },
  { slug: 'hua_hin', label: 'Hua Hin', countryCode: 'TH', lat: 12.5684, lng: 99.9577 },
  { slug: 'ayutthaya', label: 'Ayutthaya', countryCode: 'TH', lat: 14.3692, lng: 100.5877 },
  { slug: 'nakhon_ratchasima', label: 'Nakhon Ratchasima (Korat)', countryCode: 'TH', lat: 14.9799, lng: 102.0978 },
  { slug: 'khon_kaen', label: 'Khon Kaen', countryCode: 'TH', lat: 16.4419, lng: 102.836 },
  { slug: 'udon_thani', label: 'Udon Thani', countryCode: 'TH', lat: 17.4138, lng: 102.787 },
  { slug: 'chiang_mai', label: 'Chiang Mai', countryCode: 'TH', lat: 18.7883, lng: 98.9853 },
  { slug: 'chiang_rai', label: 'Chiang Rai', countryCode: 'TH', lat: 19.9105, lng: 99.8406 },
  { slug: 'phuket', label: 'Phuket', countryCode: 'TH', lat: 7.8804, lng: 98.3923 },
  { slug: 'phang_nga', label: 'Phang Nga', countryCode: 'TH', lat: 8.4501, lng: 98.5306 },
  { slug: 'krabi', label: 'Krabi', countryCode: 'TH', lat: 8.0863, lng: 98.9063 },
  { slug: 'koh_lanta', label: 'Koh Lanta', countryCode: 'TH', lat: 7.6147, lng: 99.0365 },
  { slug: 'koh_samui', label: 'Koh Samui', countryCode: 'TH', lat: 9.512, lng: 100.0136 },
  { slug: 'koh_phangan', label: 'Koh Phangan', countryCode: 'TH', lat: 9.7319, lng: 100.0136 },
  { slug: 'surat_thani', label: 'Surat Thani', countryCode: 'TH', lat: 9.1382, lng: 99.3217 },
  { slug: 'trang', label: 'Trang', countryCode: 'TH', lat: 7.559, lng: 99.611 },
  { slug: 'songkhla', label: 'Songkhla / Hat Yai', countryCode: 'TH', lat: 7.0084, lng: 100.4767 },
];

export const LOCATION_AREAS: LocationArea[] = [
  // Bangkok
  { slug: 'sukhumvit', label: 'Sukhumvit', regionSlug: 'bangkok', lat: 13.7392, lng: 100.5698 },
  { slug: 'sathorn', label: 'Sathorn', regionSlug: 'bangkok', lat: 13.7189, lng: 100.5263 },
  { slug: 'silom', label: 'Silom / Bang Rak', regionSlug: 'bangkok', lat: 13.7244, lng: 100.5297 },
  { slug: 'thonglor', label: 'Thong Lo / Ekkamai', regionSlug: 'bangkok', lat: 13.7336, lng: 100.5804 },
  { slug: 'phrom_phong', label: 'Phrom Phong', regionSlug: 'bangkok', lat: 13.7307, lng: 100.5695 },
  { slug: 'asoke', label: 'Asoke / Nana', regionSlug: 'bangkok', lat: 13.737, lng: 100.5604 },
  { slug: 'ari', label: 'Ari / Phaya Thai', regionSlug: 'bangkok', lat: 13.7797, lng: 100.5446 },
  { slug: 'ladprao', label: 'Lat Phrao / Chatuchak', regionSlug: 'bangkok', lat: 13.8167, lng: 100.6033 },
  { slug: 'rama_9', label: 'Rama IX / Ratchada', regionSlug: 'bangkok', lat: 13.758, lng: 100.566 },
  { slug: 'bang_na', label: 'Bang Na / On Nut', regionSlug: 'bangkok', lat: 13.6684, lng: 100.6417 },
  { slug: 'riverside', label: 'Riverside / Charoen Krung', regionSlug: 'bangkok', lat: 13.7065, lng: 100.508 },
  { slug: 'rattanakosin', label: 'Old City / Rattanakosin', regionSlug: 'bangkok', lat: 13.7525, lng: 100.494 },
  { slug: 'thung_maha_mek', label: 'Thung Maha Mek / Rama III', regionSlug: 'bangkok', lat: 13.687, lng: 100.545 },
  { slug: 'huai_khwang', label: 'Huai Khwang / Thailand Cultural Center', regionSlug: 'bangkok', lat: 13.778, lng: 100.574 },
  { slug: 'bang_kapi', label: 'Bang Kapi / Ramkhamhaeng', regionSlug: 'bangkok', lat: 13.765, lng: 100.647 },
  { slug: 'suan_luang', label: 'Suan Luang / On Nut Extension', regionSlug: 'bangkok', lat: 13.73, lng: 100.626 },

  // Nonthaburi
  { slug: 'nonthaburi_city', label: 'Nonthaburi City', regionSlug: 'nonthaburi', lat: 13.8621, lng: 100.5144 },
  { slug: 'pak_kret', label: 'Pak Kret', regionSlug: 'nonthaburi', lat: 13.9125, lng: 100.4977 },
  { slug: 'bang_bua_thong', label: 'Bang Bua Thong', regionSlug: 'nonthaburi', lat: 13.917, lng: 100.424 },
  { slug: 'bang_yai', label: 'Bang Yai', regionSlug: 'nonthaburi', lat: 13.843, lng: 100.4 },
  { slug: 'muang_thong_thani', label: 'Muang Thong Thani', regionSlug: 'nonthaburi', lat: 13.912, lng: 100.547 },

  // Samut Prakan
  { slug: 'samut_prakan_city', label: 'Samut Prakan City', regionSlug: 'samut_prakan', lat: 13.599, lng: 100.5998 },
  { slug: 'bang_phli', label: 'Bang Phli / Airport Link', regionSlug: 'samut_prakan', lat: 13.605, lng: 100.71 },
  { slug: 'bangna_trad', label: 'Bang Na–Trad Corridor', regionSlug: 'samut_prakan', lat: 13.65, lng: 100.68 },
  { slug: 'phra_pradaeng', label: 'Phra Pradaeng', regionSlug: 'samut_prakan', lat: 13.658, lng: 100.534 },
  { slug: 'bang_bo', label: 'Bang Bo', regionSlug: 'samut_prakan', lat: 13.583, lng: 100.833 },

  // Pathum Thani
  { slug: 'pathum_thani_city', label: 'Pathum Thani City', regionSlug: 'pathum_thani', lat: 14.0208, lng: 100.525 },
  { slug: 'rangsit', label: 'Rangsit', regionSlug: 'pathum_thani', lat: 13.987, lng: 100.617 },
  { slug: 'thammasat_rangsit', label: 'Thammasat / Khlong Luang', regionSlug: 'pathum_thani', lat: 14.068, lng: 100.605 },
  { slug: 'lam_luk_ka', label: 'Lam Luk Ka', regionSlug: 'pathum_thani', lat: 13.933, lng: 100.75 },

  // Pattaya / Chonburi
  { slug: 'pattaya_central', label: 'Pattaya Central', regionSlug: 'pattaya', lat: 12.9236, lng: 100.8825 },
  { slug: 'jomtien', label: 'Jomtien', regionSlug: 'pattaya', lat: 12.8777, lng: 100.8665 },
  { slug: 'naklua', label: 'Naklua / North Pattaya', regionSlug: 'pattaya', lat: 12.96, lng: 100.886 },
  { slug: 'pratumnak', label: 'Pratumnak Hill', regionSlug: 'pattaya', lat: 12.91, lng: 100.87 },
  { slug: 'bang_saray', label: 'Bang Saray', regionSlug: 'pattaya', lat: 12.78, lng: 100.93 },
  { slug: 'si_racha', label: 'Si Racha', regionSlug: 'pattaya', lat: 13.174, lng: 100.928 },
  { slug: 'bang_lamung', label: 'Bang Lamung', regionSlug: 'pattaya', lat: 12.977, lng: 100.911 },

  // Rayong
  { slug: 'rayong_city', label: 'Rayong City', regionSlug: 'rayong', lat: 12.6833, lng: 101.2372 },
  { slug: 'ban_chang', label: 'Ban Chang', regionSlug: 'rayong', lat: 12.725, lng: 101.055 },
  { slug: 'map_ta_phut', label: 'Map Ta Phut', regionSlug: 'rayong', lat: 12.73, lng: 101.15 },
  { slug: 'klaeng', label: 'Klaeng', regionSlug: 'rayong', lat: 12.78, lng: 101.65 },
  { slug: 'koh_samet', label: 'Koh Samet', regionSlug: 'rayong', lat: 12.568, lng: 101.455 },

  // Hua Hin
  { slug: 'hua_hin_town', label: 'Hua Hin Town', regionSlug: 'hua_hin', lat: 12.5684, lng: 99.9577 },
  { slug: 'hua_hin_beachfront', label: 'Hua Hin Beachfront', regionSlug: 'hua_hin', lat: 12.57, lng: 99.96 },
  { slug: 'cha_am', label: 'Cha-am', regionSlug: 'hua_hin', lat: 12.8, lng: 99.967 },
  { slug: 'khao_takiab', label: 'Khao Takiab', regionSlug: 'hua_hin', lat: 12.515, lng: 99.975 },
  { slug: 'pran_buri', label: 'Pran Buri', regionSlug: 'hua_hin', lat: 12.385, lng: 99.91 },

  // Ayutthaya
  { slug: 'ayutthaya_city', label: 'Ayutthaya Historic City', regionSlug: 'ayutthaya', lat: 14.3692, lng: 100.5877 },
  { slug: 'bang_pa_in', label: 'Bang Pa-in', regionSlug: 'ayutthaya', lat: 14.23, lng: 100.58 },
  { slug: 'wang_noi', label: 'Wang Noi', regionSlug: 'ayutthaya', lat: 14.23, lng: 100.73 },
  { slug: 'nakhon_luang', label: 'Nakhon Luang', regionSlug: 'ayutthaya', lat: 14.467, lng: 100.617 },

  // Nakhon Ratchasima
  { slug: 'korat_city', label: 'Korat City Center', regionSlug: 'nakhon_ratchasima', lat: 14.9799, lng: 102.0978 },
  { slug: 'pak_chong', label: 'Pak Chong / Khao Yai', regionSlug: 'nakhon_ratchasima', lat: 14.708, lng: 101.416 },
  { slug: 'sung_noen', label: 'Sung Noen', regionSlug: 'nakhon_ratchasima', lat: 14.9, lng: 101.82 },
  { slug: 'sikhiu', label: 'Sikhiu', regionSlug: 'nakhon_ratchasima', lat: 14.9, lng: 101.73 },

  // Khon Kaen
  { slug: 'khon_kaen_city', label: 'Khon Kaen City', regionSlug: 'khon_kaen', lat: 16.4419, lng: 102.836 },
  { slug: 'kk_university', label: 'Khon Kaen University Area', regionSlug: 'khon_kaen', lat: 16.474, lng: 102.823 },
  { slug: 'ban_phai', label: 'Ban Phai', regionSlug: 'khon_kaen', lat: 16.06, lng: 102.73 },
  { slug: 'chum_phae', label: 'Chum Phae', regionSlug: 'khon_kaen', lat: 16.544, lng: 102.1 },

  // Udon Thani
  { slug: 'udon_city', label: 'Udon Thani City', regionSlug: 'udon_thani', lat: 17.4138, lng: 102.787 },
  { slug: 'udon_central', label: 'Central Plaza / Mak Khaeng', regionSlug: 'udon_thani', lat: 17.4, lng: 102.8 },
  { slug: 'ban_dung', label: 'Ban Dung', regionSlug: 'udon_thani', lat: 17.7, lng: 103.26 },
  { slug: 'kumphawapi', label: 'Kumphawapi', regionSlug: 'udon_thani', lat: 17.12, lng: 103.02 },

  // Chiang Mai
  { slug: 'cm_city', label: 'Chiang Mai City', regionSlug: 'chiang_mai', lat: 18.7883, lng: 98.9853 },
  { slug: 'cm_nimman', label: 'Nimman / Old City', regionSlug: 'chiang_mai', lat: 18.7967, lng: 98.9683 },
  { slug: 'cm_hang_dong', label: 'Hang Dong', regionSlug: 'chiang_mai', lat: 18.687, lng: 98.919 },
  { slug: 'cm_san_sai', label: 'San Sai', regionSlug: 'chiang_mai', lat: 18.85, lng: 99.043 },
  { slug: 'cm_mae_rim', label: 'Mae Rim', regionSlug: 'chiang_mai', lat: 18.914, lng: 98.945 },
  { slug: 'cm_do_saket', label: 'Doi Saket', regionSlug: 'chiang_mai', lat: 18.87, lng: 99.136 },
  { slug: 'cm_saraphi', label: 'Saraphi', regionSlug: 'chiang_mai', lat: 18.713, lng: 99.043 },

  // Chiang Rai
  { slug: 'chiang_rai_city', label: 'Chiang Rai City', regionSlug: 'chiang_rai', lat: 19.9105, lng: 99.8406 },
  { slug: 'mae_sai', label: 'Mae Sai', regionSlug: 'chiang_rai', lat: 20.433, lng: 99.883 },
  { slug: 'chiang_saen', label: 'Chiang Saen / Golden Triangle', regionSlug: 'chiang_rai', lat: 20.275, lng: 100.088 },
  { slug: 'mae_chan', label: 'Mae Chan', regionSlug: 'chiang_rai', lat: 20.147, lng: 99.854 },

  // Phuket
  { slug: 'phuket_town', label: 'Phuket Town', regionSlug: 'phuket', lat: 7.8804, lng: 98.3923 },
  { slug: 'patong', label: 'Patong', regionSlug: 'phuket', lat: 7.8965, lng: 98.2965 },
  { slug: 'karon', label: 'Karon', regionSlug: 'phuket', lat: 7.846, lng: 98.294 },
  { slug: 'kata', label: 'Kata', regionSlug: 'phuket', lat: 7.82, lng: 98.298 },
  { slug: 'bang_tao', label: 'Bang Tao / Laguna', regionSlug: 'phuket', lat: 7.9789, lng: 98.2866 },
  { slug: 'kamala', label: 'Kamala', regionSlug: 'phuket', lat: 7.955, lng: 98.283 },
  { slug: 'rawai', label: 'Rawai / Nai Harn', regionSlug: 'phuket', lat: 7.772, lng: 98.325 },
  { slug: 'chalong', label: 'Chalong', regionSlug: 'phuket', lat: 7.827, lng: 98.343 },
  { slug: 'thalang', label: 'Thalang / Airport Area', regionSlug: 'phuket', lat: 8.05, lng: 98.31 },
  { slug: 'surin_beach', label: 'Surin Beach', regionSlug: 'phuket', lat: 7.978, lng: 98.28 },

  // Phang Nga
  { slug: 'phang_nga_town', label: 'Phang Nga Town', regionSlug: 'phang_nga', lat: 8.4501, lng: 98.5306 },
  { slug: 'khao_lak', label: 'Khao Lak', regionSlug: 'phang_nga', lat: 8.65, lng: 98.25 },
  { slug: 'takua_pa', label: 'Takua Pa', regionSlug: 'phang_nga', lat: 8.867, lng: 98.35 },
  { slug: 'thai_mueang', label: 'Thai Mueang', regionSlug: 'phang_nga', lat: 8.45, lng: 98.25 },
  { slug: 'koh_yao', label: 'Koh Yao Noi / Yai', regionSlug: 'phang_nga', lat: 8.12, lng: 98.6 },

  // Krabi
  { slug: 'krabi_town', label: 'Krabi Town', regionSlug: 'krabi', lat: 8.0863, lng: 98.9063 },
  { slug: 'ao_nang', label: 'Ao Nang', regionSlug: 'krabi', lat: 8.036, lng: 98.822 },
  { slug: 'railay', label: 'Railay', regionSlug: 'krabi', lat: 8.011, lng: 98.84 },
  { slug: 'klong_muang', label: 'Klong Muang', regionSlug: 'krabi', lat: 8.05, lng: 98.77 },
  { slug: 'tubkaek', label: 'Tubkaek Beach', regionSlug: 'krabi', lat: 8.1, lng: 98.75 },

  // Koh Lanta
  { slug: 'lanta_saladan', label: 'Saladan', regionSlug: 'koh_lanta', lat: 7.635, lng: 99.04 },
  { slug: 'lanta_kantiang', label: 'Kantiang Bay', regionSlug: 'koh_lanta', lat: 7.52, lng: 99.05 },
  { slug: 'lanta_long_beach', label: 'Long Beach', regionSlug: 'koh_lanta', lat: 7.58, lng: 99.03 },
  { slug: 'lanta_old_town', label: 'Lanta Old Town', regionSlug: 'koh_lanta', lat: 7.53, lng: 99.09 },

  // Koh Samui
  { slug: 'chaweng', label: 'Chaweng', regionSlug: 'koh_samui', lat: 9.535, lng: 100.0618 },
  { slug: 'bophut', label: "Bophut / Fisherman's Village", regionSlug: 'koh_samui', lat: 9.555, lng: 100.026 },
  { slug: 'lamai', label: 'Lamai', regionSlug: 'koh_samui', lat: 9.467, lng: 100.05 },
  { slug: 'maenam', label: 'Maenam', regionSlug: 'koh_samui', lat: 9.57, lng: 99.99 },
  { slug: 'choeng_mon', label: 'Choeng Mon', regionSlug: 'koh_samui', lat: 9.57, lng: 100.08 },
  { slug: 'nathon', label: 'Nathon', regionSlug: 'koh_samui', lat: 9.53, lng: 99.94 },
  { slug: 'lipa_noi', label: 'Lipa Noi', regionSlug: 'koh_samui', lat: 9.48, lng: 99.93 },

  // Koh Phangan
  { slug: 'thong_sala', label: 'Thong Sala', regionSlug: 'koh_phangan', lat: 9.71, lng: 100.0 },
  { slug: 'haad_rin', label: 'Haad Rin', regionSlug: 'koh_phangan', lat: 9.675, lng: 100.067 },
  { slug: 'srithanu', label: 'Srithanu', regionSlug: 'koh_phangan', lat: 9.74, lng: 99.98 },
  { slug: 'chaloklum', label: 'Chaloklum', regionSlug: 'koh_phangan', lat: 9.78, lng: 100.02 },

  // Surat Thani
  { slug: 'surat_city', label: 'Surat Thani City', regionSlug: 'surat_thani', lat: 9.1382, lng: 99.3217 },
  { slug: 'don_sak', label: 'Don Sak (Ferry Pier)', regionSlug: 'surat_thani', lat: 9.32, lng: 99.69 },
  { slug: 'kanchanadit', label: 'Kanchanadit', regionSlug: 'surat_thani', lat: 9.17, lng: 99.47 },
  { slug: 'chia_ya', label: 'Chaiya', regionSlug: 'surat_thani', lat: 9.39, lng: 99.2 },

  // Trang
  { slug: 'trang_city', label: 'Trang City', regionSlug: 'trang', lat: 7.559, lng: 99.611 },
  { slug: 'kantang', label: 'Kantang', regionSlug: 'trang', lat: 7.41, lng: 99.52 },
  { slug: 'pak_meng', label: 'Pak Meng Beach', regionSlug: 'trang', lat: 7.5, lng: 99.32 },
  { slug: 'yan_ta_khao', label: 'Yan Ta Khao', regionSlug: 'trang', lat: 7.4, lng: 99.67 },

  // Songkhla / Hat Yai
  { slug: 'hat_yai', label: 'Hat Yai', regionSlug: 'songkhla', lat: 7.0084, lng: 100.4767 },
  { slug: 'songkhla_city', label: 'Songkhla City', regionSlug: 'songkhla', lat: 7.2, lng: 100.595 },
  { slug: 'sadao', label: 'Sadao', regionSlug: 'songkhla', lat: 6.64, lng: 100.42 },
  { slug: 'singhanakhon', label: 'Singhanakhon', regionSlug: 'songkhla', lat: 7.23, lng: 100.55 },
];

export const DEFAULT_SERVICE_LOCATIONS: ServiceLocation[] = [
  { regionSlug: DEFAULT_LOCATION_REGION_SLUG },
];

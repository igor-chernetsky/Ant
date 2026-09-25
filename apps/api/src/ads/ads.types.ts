export type LocaleCopy = {
  en: string;
  ru: string;
  th: string;
};

/**
 * Slide layout. `card` is the original layout (image plus copy), `image` shows
 * the picture alone.
 */
export type HomeAdSlideTemplate = 'card' | 'image';

export interface HomeAdSlideDto {
  id: string;
  sortOrder: number;
  enabled: boolean;
  template: HomeAdSlideTemplate;
  /** Required for `card`; optional for `image` (empty opens the lightbox). */
  href: string | null;
  imageUrl: string;
  title: LocaleCopy;
  description: LocaleCopy;
  ctaLabel: LocaleCopy;
}

export interface UpsertHomeAdSlideDto {
  sortOrder?: number;
  enabled?: boolean;
  template?: HomeAdSlideTemplate;
  href?: string | null;
  imageUrl?: string;
  title?: Partial<LocaleCopy>;
  description?: Partial<LocaleCopy>;
  ctaLabel?: Partial<LocaleCopy>;
}

export interface PublicHomeAdSlideDto {
  id: string;
  template: HomeAdSlideTemplate;
  href: string | null;
  imageUrl: string;
  title: LocaleCopy;
  description: LocaleCopy;
  ctaLabel: LocaleCopy;
}

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

/** Where the slide image comes from. */
export type HomeAdImageSource = 'url' | 'upload';

export interface HomeAdSlideDto {
  id: string;
  sortOrder: number;
  enabled: boolean;
  template: HomeAdSlideTemplate;
  /** Required for `card`; optional for `image` (empty opens the lightbox). */
  href: string | null;
  /** External or static image URL; `null` when the image was uploaded. */
  imageUrl: string | null;
  /** `true` when the image is served from object storage. */
  imageUploaded: boolean;
  title: LocaleCopy;
  description: LocaleCopy;
  ctaLabel: LocaleCopy;
}

export interface UpsertHomeAdSlideDto {
  sortOrder?: number;
  enabled?: boolean;
  template?: HomeAdSlideTemplate;
  /** Defaults to `url`, or `upload` when an `imageStorageKey` is sent. */
  imageSource?: HomeAdImageSource;
  imageUrl?: string | null;
  /** Key returned by the presign endpoint, after the browser uploaded the file. */
  imageStorageKey?: string;
  href?: string | null;
  title?: Partial<LocaleCopy>;
  description?: Partial<LocaleCopy>;
  ctaLabel?: Partial<LocaleCopy>;
}

export interface PresignAdImageDto {
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface PublicHomeAdSlideDto {
  id: string;
  template: HomeAdSlideTemplate;
  href: string | null;
  imageUrl: string | null;
  imageUploaded: boolean;
  title: LocaleCopy;
  description: LocaleCopy;
  ctaLabel: LocaleCopy;
}

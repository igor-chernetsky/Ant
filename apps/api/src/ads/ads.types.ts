export type LocaleCopy = {
  en: string;
  ru: string;
  th: string;
};

export interface HomeAdSlideDto {
  id: string;
  sortOrder: number;
  enabled: boolean;
  href: string;
  imageUrl: string;
  title: LocaleCopy;
  description: LocaleCopy;
  ctaLabel: LocaleCopy;
}

export interface UpsertHomeAdSlideDto {
  sortOrder?: number;
  enabled?: boolean;
  href?: string;
  imageUrl?: string;
  title?: Partial<LocaleCopy>;
  description?: Partial<LocaleCopy>;
  ctaLabel?: Partial<LocaleCopy>;
}

export interface PublicHomeAdSlideDto {
  id: string;
  href: string;
  imageUrl: string;
  title: LocaleCopy;
  description: LocaleCopy;
  ctaLabel: LocaleCopy;
}

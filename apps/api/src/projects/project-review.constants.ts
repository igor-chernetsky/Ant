export const REVIEW_RATING_CATEGORIES = [
  { key: 'quality', label: 'Quality of work' },
  { key: 'timeline', label: 'Timeline adherence' },
  { key: 'communication', label: 'Communication' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'value', label: 'Value for money' },
  { key: 'siteConduct', label: 'Site conduct & cleanliness' },
] as const;

export type ReviewRatingCategory =
  (typeof REVIEW_RATING_CATEGORIES)[number]['key'];

export const REVIEW_RATING_KEYS: ReviewRatingCategory[] =
  REVIEW_RATING_CATEGORIES.map((item) => item.key);

export const MIN_REVIEW_RATING = 1;
export const MAX_REVIEW_RATING = 5;

export const MAX_REVIEW_ATTACHMENTS = 10;
export const MAX_REVIEW_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const ALLOWED_REVIEW_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export function buildReviewAttachmentStorageKey(
  projectId: string,
  attachmentId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
  return `project-reviews/${projectId}/${attachmentId}/${safeName}`;
}

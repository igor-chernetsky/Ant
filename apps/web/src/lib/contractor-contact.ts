export const PREFERRED_CONTACT_METHODS = [
  'phone',
  'line',
  'whatsapp',
  'email',
] as const;

export type PreferredContactMethod =
  (typeof PREFERRED_CONTACT_METHODS)[number];

/** Thai Tax ID — exactly 13 digits (non-digits stripped for validation). */
export function isValidThaiTaxId(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const digits = String(raw).replace(/\D/g, '');
  return /^\d{13}$/.test(digits);
}

export function normalizeThaiTaxIdInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 13);
}

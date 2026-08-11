export const PREFERRED_CONTACT_METHODS = [
  'phone',
  'line',
  'whatsapp',
  'email',
] as const;

export type PreferredContactMethod =
  (typeof PREFERRED_CONTACT_METHODS)[number];

const PREFERRED_CONTACT_SET = new Set<string>(PREFERRED_CONTACT_METHODS);

/** Thai Tax ID / เลขผู้เสียภาษี — exactly 13 digits. */
export function normalizeThaiTaxId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

export function isValidThaiTaxId(raw: string | null | undefined): boolean {
  const digits = normalizeThaiTaxId(raw);
  return digits != null && /^\d{13}$/.test(digits);
}

export function normalizePreferredContactMethods(
  raw: unknown,
): PreferredContactMethod[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<PreferredContactMethod>();
  for (const item of raw) {
    const value = String(item ?? '')
      .trim()
      .toLowerCase();
    if (PREFERRED_CONTACT_SET.has(value)) {
      seen.add(value as PreferredContactMethod);
    }
  }
  return PREFERRED_CONTACT_METHODS.filter((method) => seen.has(method));
}

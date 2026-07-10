import type { Locale } from '@/lib/i18n';
import { fetchWithAuth } from '@/lib/auth-client';

export async function updatePreferredLocale(
  locale: Locale,
): Promise<{ preferredLocale: Locale }> {
  const response = await fetchWithAuth('/api/me/locale', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to update language');
  }

  return response.json() as Promise<{ preferredLocale: Locale }>;
}

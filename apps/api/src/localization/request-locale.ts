import type { Request } from 'express';
import { LOCALE_HEADER, resolveRequestLocale } from './locale.utils';
import type { SupportedLocale } from '../users/locale.types';

export function readLocaleHeader(req: Request): string | null {
  const raw = req.headers[LOCALE_HEADER];
  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }
  return raw ?? null;
}

export function resolveLocaleFromRequest(
  req: Request,
  userLocale?: string | null,
): SupportedLocale {
  return resolveRequestLocale({
    headerLocale: readLocaleHeader(req),
    userLocale,
  });
}

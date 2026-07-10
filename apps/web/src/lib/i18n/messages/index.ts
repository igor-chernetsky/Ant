import type { Locale } from '../locales';
import { en, type Messages } from './en';
import { ru } from './ru';
import { th } from './th';

export const messages: Record<Locale, Messages> = {
  en,
  th,
  ru,
};

export { en, th, ru };
export type { Messages, MessageKey } from './en';

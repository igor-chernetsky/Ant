import type { SupportedLocale } from '../users/locale.types';

type BidMessageCopy = {
  subject: (projectTitle: string) => string;
  title: string;
  bodyLead: (projectTitle: string) => string;
  ctaClient: string;
  ctaContractor: string;
};

const BID_MESSAGE_COPY: Record<SupportedLocale, BidMessageCopy> = {
  en: {
    subject: (projectTitle) => `New message on ${projectTitle}`,
    title: 'New message on your bid',
    bodyLead: (projectTitle) =>
      `You have a new message regarding <strong>${projectTitle}</strong>:`,
    ctaClient: 'View applications',
    ctaContractor: 'Open conversation',
  },
  ru: {
    subject: (projectTitle) => `Новое сообщение по проекту ${projectTitle}`,
    title: 'Новое сообщение по заявке',
    bodyLead: (projectTitle) =>
      `У вас новое сообщение по проекту <strong>${projectTitle}</strong>:`,
    ctaClient: 'Смотреть заявки',
    ctaContractor: 'Открыть переписку',
  },
  th: {
    subject: (projectTitle) => `ข้อความใหม่เกี่ยวกับ ${projectTitle}`,
    title: 'ข้อความใหม่ในข้อเสนอของคุณ',
    bodyLead: (projectTitle) =>
      `คุณมีข้อความใหม่เกี่ยวกับ <strong>${projectTitle}</strong>:`,
    ctaClient: 'ดูใบสมัคร',
    ctaContractor: 'เปิดการสนทนา',
  },
};

export function bidMessageEmailCopy(locale: SupportedLocale): BidMessageCopy {
  return BID_MESSAGE_COPY[locale] ?? BID_MESSAGE_COPY.en;
}

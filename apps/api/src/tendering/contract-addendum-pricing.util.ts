import type { SupportedLocale } from '../users/locale.types';
import {
  computeBidCostAdjustments,
  COST_ADJUSTMENT_TOLERANCE_THB,
  DEFAULT_VAT_PERCENT,
  type BidCostAdjustments,
  type BidCostAdjustmentResult,
} from './bid-cost-adjustments.util';

export type ParsedContractAmountTaxMode = 'incl_vat' | 'excl_vat';

export interface ParsedContractAmount {
  amount: number;
  taxMode: ParsedContractAmountTaxMode;
}

/** Word chars incl. Cyrillic/Thai — JS \w is ASCII-only even with /u. */
const WORD = '[\\p{L}\\p{N}_]';

const INCL_VAT_PATTERN =
  /(?:incl(?:uding|\.?)?\s*(?:vat|value added tax|nds|tax)|with\s*vat|including\s*vat|vat\s*incl(?:uded)?|с\s*ндс|в\s*т\.?\s*ч\.?\s*ндс|включ(?:ая|ительно)?\s*ндс|с\s*уч[её]том\s*ндс|รวม\s*(?:vat|ภาษี)|รวม\s*vat)/iu;
const EXCL_VAT_PATTERN =
  /(?:excl(?:uding|\.?)?\s*(?:vat|value added tax|nds|tax)|without\s*vat|excluding\s*vat|ex\s*vat|net\s+of\s+vat|plus\s+vat|без\s*ндс|не\s*включ(?:ая|ительно)?\s*ндс|без\s*уч[её]та\s*ндс|(?:^|[^\p{L}\p{N}])\+\s*ндс(?:[^\p{L}\p{N}]|$)|ไม่รวม\s*(?:vat|ภาษี))/iu;

/** Typical phrasing where users state a revised contract amount (capture group 1 = amount). */
const TYPICAL_AMOUNT_PHRASES: RegExp[] = [
  // Russian — common KP / addendum wording
  new RegExp(
    `(?:нов(?:ая|ой|ую)\\s+)?(?:стоимост${WORD}*|сумм${WORD}*|цен${WORD}*)\\s+(?:договор${WORD}*\\s*)?(?:состав${WORD}*|равн${WORD}*|до|—|:|-)?\\s*([\\d][\\d\\s.,]*(?:\\s*(?:млн|million|mln|m|тыс|k|ล้าน|baht|бат|thb|฿))?)`,
    'giu',
  ),
  new RegExp(
    `(?:итог(?:овая|овой)?|общ(?:ая|ей)|конечн${WORD}*)\\s+(?:сумм${WORD}*|стоимост${WORD}*)[\\s:—-]*([\\d][\\d\\s.,]*(?:\\s*(?:млн|million|mln|m|тыс|k|ล้าน|baht|бат|thb|฿))?)`,
    'giu',
  ),
  new RegExp(
    `(?:увелич${WORD}*|уменьш${WORD}*|измен${WORD}*|корректир${WORD}*|пересмотр${WORD}*)${WORD}*\\s+(?:стоимост${WORD}*|сумм${WORD}*|цен${WORD}*)\\s+(?:до|на)\\s+([\\d][\\d\\s.,]*(?:\\s*(?:млн|million|mln|m|тыс|k|ล้าน|baht|бат|thb|฿))?)`,
    'giu',
  ),
  new RegExp(
    `(?:сумм${WORD}*|стоимост${WORD}*)\\s+договор${WORD}*[\\s:—-]*([\\d][\\d\\s.,]*(?:\\s*(?:млн|million|mln|m|тыс|k|ล้าน|baht|бат|thb|฿))?)`,
    'giu',
  ),
  new RegExp(
    `(?:договор${WORD}*\\s+)?(?:на\\s+)?(?:сумм${WORD}*|стоимост${WORD}*)[\\s:—-]*([\\d][\\d\\s.,]*(?:\\s*(?:млн|million|mln|m|тыс|k|ล้าน|baht|бат|thb|฿))?)`,
    'giu',
  ),
  new RegExp(
    `(?:общая\\s+)?(?:стоимост${WORD}*|сумм${WORD}*)\\s+(?:контракт${WORD}*|проект${WORD}*)[\\s:—-]*([\\d][\\d\\s.,]*(?:\\s*(?:млн|million|mln|m|тыс|k|ล้าน|baht|бат|thb|฿))?)`,
    'giu',
  ),
  // English
  /(?:new|revised|updated|adjusted|total)\s+(?:contract\s+)?(?:amount|price|value|sum|cost)[\s:—-]*([\d][\d\s.,]*(?:\s*(?:million|mln|m|k|thousand|baht|thb|฿))?)/giu,
  /(?:contract\s+)?(?:amount|price|value|sum)\s+(?:is\s+)?(?:now|revised\s+to|increased\s+to|reduced\s+to|changed\s+to|set\s+at|of)[\s:—-]*([\d][\d\s.,]*(?:\s*(?:million|mln|m|k|thousand|baht|thb|฿))?)/giu,
  /(?:increase|reduce|change|revise)\w*\s+(?:the\s+)?(?:contract\s+)?(?:amount|price|value)\s+(?:to\s+)?([\d][\d\s.,]*(?:\s*(?:million|mln|m|k|thousand|baht|thb|฿))?)/giu,
  /(?:grand\s+total|total\s+(?:contract\s+)?(?:amount|price|value))[\s:—-]*([\d][\d\s.,]*(?:\s*(?:million|mln|m|k|thousand|baht|thb|฿))?)/giu,
  /(?:contract\s+)?(?:sum|value)\s+of\s+(?:THB|฿|baht)?\s*([\d][\d\s.,]*(?:\s*(?:million|mln|m|k|thousand|baht|thb|฿))?)/giu,
  // Thai
  /(?:มูลค่า|ราคา|ค่\s*สัญญา|ยอด\s*รวม)(?:\s*ใหม่|\s*สัญญา)?[\s:—-]*([\d][\d\s.,]*(?:\s*(?:ล้าน|million|mln|m|baht|thb|฿))?)/giu,
  /(?:ปรับ|เพิ่ม|ลด)(?:\s*มูลค่า|\s*ราคา)?(?:\s*สัญญา)?(?:\s*เป็น|\s*เหลือ)?[\s:—-]*([\d][\d\s.,]*(?:\s*(?:ล้าน|million|mln|m|baht|thb|฿))?)/giu,
];

const AMOUNT_CONTEXT_PATTERN =
  new RegExp(
    `\\b(new|updated|revised|adjusted|contract|total|amount|price|cost|sum|grand\\s*total|increase|reduce|change|стоимост${WORD}*|сумм${WORD}*|договор${WORD}*|контракт${WORD}*|итого|пересмотр${WORD}*|увелич${WORD}*|уменьш${WORD}*|มูลค่า|ราคา|สัญญา|ยอด\\s*รวม)\\b`,
    'iu',
  );

const LOOSE_AMOUNT_TOKEN =
  /(?:THB|฿|baht|бат|bath)?\s*([\d][\d\s.,]*(?:\s*(?:млн|million|mln|m|тыс|k|thousand|ล้าน|baht|бат|thb|฿))?)\s*(?:THB|฿|baht|бат|bath)?/giu;

const DATE_LIKE =
  /\b(?:0?[1-9]|[12]\d|3[01])[./](?:0?[1-9]|1[0-2])[./](?:20\d{2}|19\d{2})\b/;

function parseAmountExpression(raw: string): number | null {
  let s = raw.trim().toLowerCase();
  if (!s) {
    return null;
  }

  let multiplier = 1;
  if (/(млн|million|mln|ล้าน)/i.test(s)) {
    multiplier = 1_000_000;
    s = s.replace(/(млн|million|mln|ล้าน)/gi, '');
  } else if (/(?:^|\s)m(?:\s|$)/i.test(s)) {
    multiplier = 1_000_000;
    s = s.replace(/(?:^|\s)m(?:\s|$)/gi, ' ');
  } else if (/(тыс|thousand)/i.test(s)) {
    multiplier = 1_000;
    s = s.replace(/(тыс|thousand)/gi, '');
  } else if (/(?:^|\s)k(?:\s|$)/i.test(s)) {
    multiplier = 1_000;
    s = s.replace(/(?:^|\s)k(?:\s|$)/gi, ' ');
  }

  s = s.replace(/(?:thb|฿|baht|бат|bath)/gi, '').trim();
  s = s.replace(/\s+/g, '');

  // European thousands: 3.500.000 or 3.500.000,50
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (/^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }

  const value = Number(s) * multiplier;
  if (!Number.isFinite(value) || value < 1_000) {
    return null;
  }
  return Math.round(value);
}

function contextWindow(text: string, start: number, end: number): string {
  return text.slice(Math.max(0, start - 100), Math.min(text.length, end + 100));
}

function looksLikeDateWindow(window: string): boolean {
  return DATE_LIKE.test(window);
}

function detectTaxMode(context: string): ParsedContractAmountTaxMode {
  if (EXCL_VAT_PATTERN.test(context)) {
    return 'excl_vat';
  }
  if (INCL_VAT_PATTERN.test(context)) {
    return 'incl_vat';
  }
  // "+ VAT" / "+ НДС" after amount usually means ex-VAT base
  if (/(?:\+\s*vat|\+\s*ндс|plus\s*vat)/i.test(context)) {
    return 'excl_vat';
  }
  return 'incl_vat';
}

function scoreCandidate(
  window: string,
  source: 'phrase' | 'token',
): number {
  let score = source === 'phrase' ? 12 : 0;
  if (AMOUNT_CONTEXT_PATTERN.test(window)) {
    score += 3;
  }
  if (/(THB|฿|baht|бат|bath)/i.test(window)) {
    score += 2;
  }
  if (INCL_VAT_PATTERN.test(window) || EXCL_VAT_PATTERN.test(window)) {
    score += 3;
  }
  if (/(млн|million|mln|ล้าน|тыс|thousand)/i.test(window)) {
    score += 1;
  }
  if (looksLikeDateWindow(window)) {
    score -= 20;
  }
  return score;
}

/** Extract a contract total from free-text addendum description. */
export function parseContractAmountFromDescription(
  description: string,
): ParsedContractAmount | null {
  const text = description.trim();
  if (!text) {
    return null;
  }

  type Candidate = {
    amount: number;
    score: number;
    taxMode: ParsedContractAmountTaxMode;
  };

  const candidates: Candidate[] = [];

  for (const pattern of TYPICAL_AMOUNT_PHRASES) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const amount = parseAmountExpression(match[1] ?? '');
      if (amount == null) {
        continue;
      }
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const window = contextWindow(text, start, end);
      candidates.push({
        amount,
        score: scoreCandidate(window, 'phrase'),
        taxMode: detectTaxMode(window),
      });
    }
  }

  for (const match of text.matchAll(LOOSE_AMOUNT_TOKEN)) {
    const amount = parseAmountExpression(match[1] ?? '');
    if (amount == null) {
      continue;
    }
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const window = contextWindow(text, start, end);
    candidates.push({
      amount,
      score: scoreCandidate(window, 'token'),
      taxMode: detectTaxMode(window),
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score || b.amount - a.amount);
  const best = candidates[0];
  if (best.score < 0) {
    return null;
  }
  return { amount: best.amount, taxMode: best.taxMode };
}

export function resolveAddendumPricingPercents(
  stored: BidCostAdjustments | null | undefined,
): {
  preliminaryPercent: number;
  overheadProfitPercent: number;
  vatPercent: number;
} {
  return {
    preliminaryPercent: stored?.preliminaryPercent ?? 0,
    overheadProfitPercent: stored?.overheadProfitPercent ?? 0,
    vatPercent: stored?.vatPercent ?? DEFAULT_VAT_PERCENT,
  };
}

export function inferPricingFromGrandTotal(
  grandTotal: number,
  percents: {
    preliminaryPercent: number;
    overheadProfitPercent: number;
    vatPercent: number;
  },
): BidCostAdjustmentResult {
  const seedWorks = Math.round(
    grandTotal /
      (1 + percents.vatPercent / 100) /
      (1 +
        percents.preliminaryPercent / 100 +
        percents.overheadProfitPercent / 100),
  );

  let best = computeBidCostAdjustments({
    worksSubtotal: Math.max(seedWorks, 1),
    ...percents,
  });
  let bestDelta = Math.abs(best.grandTotal - grandTotal);

  for (let offset = -12; offset <= 12; offset += 1) {
    const worksSubtotal = Math.max(seedWorks + offset, 1);
    const candidate = computeBidCostAdjustments({
      worksSubtotal,
      ...percents,
    });
    const delta = Math.abs(candidate.grandTotal - grandTotal);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }

  return best;
}

function formatThb(amount: number, locale: SupportedLocale): string {
  const numberLocale =
    locale === 'th' ? 'th-TH' : locale === 'ru' ? 'ru-RU' : 'en-US';
  return `THB ${amount.toLocaleString(numberLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function copyFor(locale: SupportedLocale) {
  if (locale === 'ru') {
    return {
      heading: 'Разбивка суммы договора',
      works: 'Стоимость работ',
      preliminary: 'Preliminary',
      overhead: 'Overhead & profit',
      subtotalExVat: 'Промежуточный итог (без НДС)',
      vat: (pct: number) => `НДС (${pct}%)`,
      grandTotal: 'Итого с НДС',
      noteIncl:
        'Сумма из описания трактуется как итог с НДС; ставки взяты из коммерческого предложения.',
      noteExcl:
        'Сумма из описания трактуется как стоимость работ без НДС; ставки взяты из коммерческого предложения.',
    };
  }
  if (locale === 'th') {
    return {
      heading: 'รายละเอียดมูลค่าสัญญา',
      works: 'มูลค่างาน',
      preliminary: 'Preliminary',
      overhead: 'Overhead & profit',
      subtotalExVat: 'ยอดรวมก่อน VAT',
      vat: (pct: number) => `VAT (${pct}%)`,
      grandTotal: 'รวมทั้งสิ้น (รวม VAT)',
      noteIncl:
        'ยอดจากคำอธิบายถือว่ารวม VAT แล้ว อัตราคำนวณจากข้อเสนอเชิงพาณิชย์',
      noteExcl:
        'ยอดจากคำอธิบายถือว่าเป็นมูลค่างานไม่รวม VAT อัตราคำนวณจากข้อเสนอเชิงพาณิชย์',
    };
  }
  return {
    heading: 'Contract amount breakdown',
    works: 'Works',
    preliminary: 'Preliminary',
    overhead: 'Overhead & profit',
    subtotalExVat: 'Subtotal (excl. VAT)',
    vat: (pct: number) => `VAT (${pct}%)`,
    grandTotal: 'Grand total (incl. VAT)',
    noteIncl:
      'The amount in your description is treated as VAT-inclusive; rates match the commercial proposal.',
    noteExcl:
      'The amount in your description is treated as works value excl. VAT; rates match the commercial proposal.',
  };
}

function renderPricingTable(
  breakdown: BidCostAdjustmentResult,
  locale: SupportedLocale,
  taxMode: ParsedContractAmountTaxMode,
): string {
  const copy = copyFor(locale);
  const rows: Array<[string, string]> = [
    [copy.works, formatThb(breakdown.worksSubtotal, locale)],
  ];
  if (breakdown.preliminaryAmount > 0) {
    rows.push([
      `${copy.preliminary} (${breakdown.preliminaryPercent}%)`,
      formatThb(breakdown.preliminaryAmount, locale),
    ]);
  }
  if (breakdown.overheadProfitAmount > 0) {
    rows.push([
      `${copy.overhead} (${breakdown.overheadProfitPercent}%)`,
      formatThb(breakdown.overheadProfitAmount, locale),
    ]);
  }
  rows.push([
    copy.subtotalExVat,
    formatThb(breakdown.taxableSubtotal, locale),
  ]);
  if (breakdown.vatAmount > 0) {
    rows.push([
      copy.vat(breakdown.vatPercent),
      formatThb(breakdown.vatAmount, locale),
    ]);
  }
  rows.push([copy.grandTotal, formatThb(breakdown.grandTotal, locale)]);

  const body = rows
    .map(
      ([label, value]) =>
        `<tr><th scope="row">${label}</th><td>${value}</td></tr>`,
    )
    .join('');

  return `<h3>${copy.heading}</h3>
<p><em>${taxMode === 'excl_vat' ? copy.noteExcl : copy.noteIncl}</em></p>
<table>
<thead><tr><th scope="col">Item</th><th scope="col">Amount</th></tr></thead>
<tbody>${body}</tbody>
</table>`;
}

function htmlAlreadyHasPricingBreakdown(
  html: string,
  amount: number,
  taxMode: ParsedContractAmountTaxMode,
): boolean {
  if (!/(vat|nds|ндс|value added tax|ภาษี)/i.test(html)) {
    return false;
  }
  const numbers = [...html.matchAll(/[\d][\d,\s.]*(?:\.\d{1,2})?/g)]
    .map((match) => parseAmountExpression(match[0]))
    .filter((value): value is number => value != null);

  const targets =
    taxMode === 'excl_vat'
      ? [amount]
      : [amount];
  return targets.some((target) =>
    numbers.some(
      (value) => Math.abs(value - target) <= COST_ADJUSTMENT_TOLERANCE_THB,
    ),
  );
}

/** Append a deterministic VAT breakdown when the description states a contract amount. */
export function enrichAddendumHtmlWithPricing(
  description: string,
  html: string,
  costAdjustments: BidCostAdjustments | null | undefined,
  locale: SupportedLocale,
): string {
  const parsed = parseContractAmountFromDescription(description);
  if (!parsed) {
    return html;
  }
  if (htmlAlreadyHasPricingBreakdown(html, parsed.amount, parsed.taxMode)) {
    return html;
  }

  const percents = resolveAddendumPricingPercents(costAdjustments);
  const breakdown =
    parsed.taxMode === 'excl_vat'
      ? computeBidCostAdjustments({
          worksSubtotal: parsed.amount,
          ...percents,
        })
      : inferPricingFromGrandTotal(parsed.amount, percents);

  return `${html.trim()}\n${renderPricingTable(breakdown, locale, parsed.taxMode)}`;
}

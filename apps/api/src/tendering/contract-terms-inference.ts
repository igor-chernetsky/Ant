import type { ProjectBriefV1 } from '../projects/project-brief';

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function parseIsoDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return formatDateForInput(new Date(parsed));
}

export function monthsFromDurationDays(
  days?: number | null,
): number | undefined {
  if (days == null || days < 1) {
    return undefined;
  }
  return Math.max(1, Math.round(days / 30));
}

export function parseDurationMonthsFromText(text: string): number | undefined {
  const monthsMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:months?|mo\b)/i);
  if (monthsMatch) {
    const value = Number(monthsMatch[1]);
    if (Number.isFinite(value) && value >= 1) {
      return Math.round(value);
    }
  }

  const weeksMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:weeks?|wks?\b)/i);
  if (weeksMatch) {
    const value = Number(weeksMatch[1]);
    if (Number.isFinite(value) && value >= 1) {
      return Math.max(1, Math.round(value / 4));
    }
  }

  const daysMatch = text.match(/(\d+(?:\.\d+)?)\s*days?\b/i);
  if (daysMatch) {
    const value = Number(daysMatch[1]);
    if (Number.isFinite(value) && value >= 1) {
      return monthsFromDurationDays(value);
    }
  }

  return undefined;
}

function collectBriefTextSources(brief?: ProjectBriefV1 | null): string[] {
  if (!brief) {
    return [];
  }

  const texts = [
    brief.summary,
    brief.ai?.improvedDescription,
    brief.constraints,
  ];

  for (const answer of brief.ai?.intake?.answers ?? []) {
    if (answer.skipped) {
      continue;
    }
    if (answer.customText?.trim()) {
      texts.push(answer.customText.trim());
    }
    const value = answer.value;
    if (Array.isArray(value)) {
      texts.push(...value.map((item) => String(item)));
    } else if (value) {
      texts.push(String(value));
    }
  }

  return texts.filter(Boolean) as string[];
}

export function inferWorksStartDate(
  brief?: ProjectBriefV1 | null,
): string | undefined {
  const desiredStart = brief?.timeline?.desiredStart;
  if (typeof desiredStart === 'string' && desiredStart.trim()) {
    const parsed = parseIsoDate(desiredStart);
    if (parsed) {
      return parsed;
    }
  }

  const timelineAnswer = brief?.ai?.intake?.answers?.find(
    (answer) => answer.questionId === 'timeline' && !answer.skipped,
  );
  if (!timelineAnswer) {
    return undefined;
  }

  const optionId = Array.isArray(timelineAnswer.value)
    ? timelineAnswer.value[0]
    : timelineAnswer.value;
  const customText = timelineAnswer.customText?.trim() ?? '';
  const now = new Date();

  if (customText) {
    const parsedCustom = parseIsoDate(customText);
    if (parsedCustom) {
      return parsedCustom;
    }

    const inMonthsMatch = customText.match(/in\s+(\d+)\s*months?/i);
    if (inMonthsMatch) {
      return formatDateForInput(addMonths(now, Number(inMonthsMatch[1])));
    }
  }

  if (optionId === 'asap') {
    return formatDateForInput(addDays(now, 14));
  }
  if (optionId === '1-3-months') {
    return formatDateForInput(addMonths(now, 2));
  }

  return undefined;
}

export function inferContractPeriodMonths(input: {
  durationDays?: number | null;
  brief?: ProjectBriefV1 | null;
}): number | undefined {
  const fromDays = monthsFromDurationDays(input.durationDays);
  if (fromDays) {
    return fromDays;
  }

  for (const text of collectBriefTextSources(input.brief)) {
    const months = parseDurationMonthsFromText(text);
    if (months) {
      return months;
    }
  }

  return undefined;
}

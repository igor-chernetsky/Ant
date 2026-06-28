import { BadRequestException } from '@nestjs/common';
import { DEFAULT_TENDER_DURATION_DAYS } from './tendering.types';

export interface ApplicationsDeadlineInput {
  applicationsCloseAt?: string | null;
  noApplicationsDeadline?: boolean;
}

export function defaultApplicationsCloseAt(from = new Date()): Date {
  const closesAt = new Date(from);
  closesAt.setUTCDate(closesAt.getUTCDate() + DEFAULT_TENDER_DURATION_DAYS);
  closesAt.setUTCHours(23, 59, 59, 999);
  return closesAt;
}

export function defaultApplicationsCloseDateString(from = new Date()): string {
  const closesAt = defaultApplicationsCloseAt(from);
  return closesAt.toISOString().slice(0, 10);
}

/** Parse YYYY-MM-DD (or ISO datetime) to end-of-day UTC. */
export function parseApplicationsCloseAt(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestException('Application deadline date is required');
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const parsed = dateOnly
    ? new Date(`${trimmed}T23:59:59.999Z`)
    : new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid application deadline date');
  }

  const min = new Date();
  min.setUTCHours(0, 0, 0, 0);
  if (parsed.getTime() < min.getTime()) {
    throw new BadRequestException('Application deadline cannot be in the past');
  }

  if (dateOnly) {
    parsed.setUTCHours(23, 59, 59, 999);
  }

  return parsed;
}

export function resolveApplicationsCloseAt(
  input?: ApplicationsDeadlineInput,
): Date | null {
  if (input?.noApplicationsDeadline) {
    return null;
  }
  if (input?.applicationsCloseAt?.trim()) {
    return parseApplicationsCloseAt(input.applicationsCloseAt);
  }
  return defaultApplicationsCloseAt();
}

export function isApplicationsDeadlinePassed(
  closesAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!closesAt) {
    return false;
  }
  return closesAt.getTime() < now.getTime();
}

export function shouldHideProjectFromPublicDiscovery(params: {
  tenderStatus: string;
  closesAt: Date | null;
  now?: Date;
}): boolean {
  if (params.tenderStatus === 'draft') {
    return false;
  }
  return isApplicationsDeadlinePassed(params.closesAt, params.now);
}

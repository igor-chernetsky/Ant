'use client';

export interface ApplicationsDeadlineValue {
  applicationsCloseAt: string;
  noApplicationsDeadline: boolean;
}

export function defaultApplicationsCloseDateString(from = new Date()): string {
  const closesAt = new Date(from);
  closesAt.setUTCDate(closesAt.getUTCDate() + 7);
  return closesAt.toISOString().slice(0, 10);
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface TenderApplicationsDeadlineFieldsProps {
  value: ApplicationsDeadlineValue;
  onChange: (next: ApplicationsDeadlineValue) => void;
  disabled?: boolean;
  idPrefix?: string;
}

export function TenderApplicationsDeadlineFields({
  value,
  onChange,
  disabled = false,
  idPrefix = 'tender-deadline',
}: TenderApplicationsDeadlineFieldsProps) {
  return (
    <div className="tender-deadline-fields">
      <label className="tender-deadline-date-label" htmlFor={`${idPrefix}-date`}>
        Accept applications until
        <input
          id={`${idPrefix}-date`}
          type="date"
          value={value.applicationsCloseAt}
          min={todayDateString()}
          disabled={disabled || value.noApplicationsDeadline}
          onChange={(event) =>
            onChange({
              ...value,
              applicationsCloseAt: event.target.value,
            })
          }
        />
      </label>
      <label className="checkbox-label tender-deadline-unlimited">
        <input
          type="checkbox"
          checked={value.noApplicationsDeadline}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...value,
              noApplicationsDeadline: event.target.checked,
            })
          }
        />
        No time limit
      </label>
    </div>
  );
}

export function applicationsDeadlineToPayload(
  value: ApplicationsDeadlineValue,
): {
  applicationsCloseAt?: string;
  noApplicationsDeadline?: boolean;
} {
  if (value.noApplicationsDeadline) {
    return { noApplicationsDeadline: true };
  }
  return { applicationsCloseAt: value.applicationsCloseAt };
}

export function applicationsDeadlineFromTender(tender?: {
  closesAt?: string | null;
  noApplicationsDeadline?: boolean;
} | null): ApplicationsDeadlineValue {
  if (tender?.noApplicationsDeadline || !tender?.closesAt) {
    return {
      applicationsCloseAt: defaultApplicationsCloseDateString(),
      noApplicationsDeadline: true,
    };
  }
  return {
    applicationsCloseAt: tender.closesAt.slice(0, 10),
    noApplicationsDeadline: false,
  };
}

import type { PropertyType } from '@/lib/projects';

/**
 * Validation and keyboard rules for the create-project form, kept out of the
 * component so they can be tested without rendering a modal.
 */

export type CreateProjectField = 'title' | 'propertyType';

export type CreateProjectFieldError = 'titleTooShort' | 'propertyTypeRequired';

export interface CreateProjectValidationInput {
  title: string;
  propertyType: PropertyType | '';
}

/** Smallest title the backend accepts; below that the request would fail. */
export const MIN_PROJECT_TITLE_LENGTH = 3;

/**
 * Errors keyed by field. Empty object means the form may be submitted.
 *
 * The submit button is never disabled because of these — a disabled button with no
 * explanation is the main reason people abandon this form.
 */
export function validateCreateProjectForm(
  input: CreateProjectValidationInput,
): Partial<Record<CreateProjectField, CreateProjectFieldError>> {
  const errors: Partial<Record<CreateProjectField, CreateProjectFieldError>> = {};

  if (input.title.trim().length < MIN_PROJECT_TITLE_LENGTH) {
    errors.title = 'titleTooShort';
  }
  if (!input.propertyType) {
    errors.propertyType = 'propertyTypeRequired';
  }

  return errors;
}

/** Field that should receive focus after a failed submit. */
export function firstInvalidField(
  errors: Partial<Record<CreateProjectField, CreateProjectFieldError>>,
): CreateProjectField | null {
  if (errors.title) return 'title';
  if (errors.propertyType) return 'propertyType';
  return null;
}

/**
 * Whether closing the form would throw away something the visitor typed.
 *
 * Used to decide between closing straight away and asking for confirmation, so a
 * stray tap on the backdrop cannot silently delete a long description.
 */
export function hasUnsavedCreateProjectInput(input: {
  title?: string;
  description?: string;
  propertyType?: PropertyType | '';
  locationAreaSlug?: string;
  locationNote?: string;
}): boolean {
  return Boolean(
    input.title?.trim() ||
      input.description?.trim() ||
      input.propertyType ||
      input.locationAreaSlug ||
      input.locationNote?.trim(),
  );
}

/**
 * Next option for a `radiogroup` when an arrow key is pressed.
 *
 * Arrow keys wrap around, `Home`/`End` jump to the ends; any other key returns
 * `null` so the caller leaves the event alone.
 */
export function radioValueForKey<T extends string>(
  options: readonly T[],
  current: T,
  key: string,
): T | null {
  if (options.length === 0) {
    return null;
  }

  const index = Math.max(0, options.indexOf(current));

  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return options[(index + 1) % options.length] ?? null;
    case 'ArrowLeft':
    case 'ArrowUp':
      return options[(index - 1 + options.length) % options.length] ?? null;
    case 'Home':
      return options[0] ?? null;
    case 'End':
      return options[options.length - 1] ?? null;
    default:
      return null;
  }
}

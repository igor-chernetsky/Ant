import type { CreateProjectInput, ClarificationMode, ProjectType, PropertyType } from './projects';

const STORAGE_KEY = 'ant.pending-project-draft';

/**
 * A draft left behind by a visitor who filled the create-project form before
 * signing up. It only lives in this browser: an anonymous project has no owner,
 * so nothing is written to the API until an authenticated client role exists.
 *
 * The draft also carries the signup across email verification, where the new
 * account cannot sign in until the confirmation link is clicked.
 */
export interface PendingProjectDraft {
  input: CreateProjectInput;
  savedAt: number;
}

/** Older drafts are dropped rather than resurfacing weeks later. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function storage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    // Storage can be blocked (private mode, third-party cookie rules).
    return null;
  }
}

const PROJECT_TYPES = new Set<string>([
  'renovation',
  'new_build',
  'extension',
  'commercial_fitout',
  'repair',
  'modernization_reconstruction',
  'design',
  'other',
]);

const CLARIFICATION_MODES = new Set<string>(['open_chat', 'structured_qa']);

function readString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

/**
 * Rebuild a `CreateProjectInput` from stored JSON. The browser is user-writable,
 * so anything unexpected is dropped instead of being sent to the API.
 */
function parseDraft(value: unknown): CreateProjectInput | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;

  const title = readString(raw.title, 200);
  if (!title) return null;

  const projectType = readString(raw.projectType, 40);
  const propertyType = readString(raw.propertyType, 40);
  const clarificationMode = readString(raw.clarificationMode, 40);

  return {
    title,
    description: readString(raw.description, 20000),
    projectType:
      projectType && PROJECT_TYPES.has(projectType)
        ? (projectType as ProjectType)
        : undefined,
    propertyType: propertyType ? (propertyType as PropertyType) : undefined,
    locationRegionSlug: readString(raw.locationRegionSlug, 80),
    locationAreaSlug: readString(raw.locationAreaSlug, 80),
    locationNote: readString(raw.locationNote, 500),
    clarificationMode:
      clarificationMode && CLARIFICATION_MODES.has(clarificationMode)
        ? (clarificationMode as ClarificationMode)
        : undefined,
  };
}

export function savePendingProjectDraft(input: CreateProjectInput): void {
  const store = storage();
  if (!store) return;
  try {
    const draft: PendingProjectDraft = { input, savedAt: Date.now() };
    store.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // A full or blocked storage must not break project creation.
  }
}

export function readPendingProjectDraft(): CreateProjectInput | null {
  const store = storage();
  if (!store) return null;

  let parsed: PendingProjectDraft;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    parsed = JSON.parse(raw) as PendingProjectDraft;
  } catch {
    clearPendingProjectDraft();
    return null;
  }

  const savedAt = typeof parsed?.savedAt === 'number' ? parsed.savedAt : 0;
  if (!savedAt || Date.now() - savedAt > MAX_AGE_MS) {
    clearPendingProjectDraft();
    return null;
  }

  const input = parseDraft(parsed.input);
  if (!input) {
    clearPendingProjectDraft();
    return null;
  }
  return input;
}

export function clearPendingProjectDraft(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — the draft is best effort.
  }
}

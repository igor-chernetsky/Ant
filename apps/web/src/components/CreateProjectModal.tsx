'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ProjectLocationFields } from '@/components/ProjectLocationFields';
import { useTranslation } from '@/components/LocaleProvider';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { isSessionExpiredError } from '@/lib/auth-client';
import {
  DEFAULT_SERVICE_LOCATION,
  fetchLocationCatalog,
  type LocationCatalog,
} from '@/lib/locations';
import {
  firstInvalidField,
  hasUnsavedCreateProjectInput,
  radioValueForKey,
  validateCreateProjectForm,
  type CreateProjectField,
  type CreateProjectFieldError,
} from '@/lib/create-project-form';
import { canCreateProject, ensureSessionFresh } from '@/lib/session';
import { useSession } from '@/components/SessionProvider';
import {
  PROJECT_TRACKS,
  projectTrackI18nKey,
  propertyTypeFilterI18nKey,
  type ProjectTrack,
} from '@/lib/service-filters';
import {
  CLARIFICATION_MODE_OPTIONS,
  CONSTRUCTION_PROJECT_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  createProject,
  type ClarificationMode,
  type CreateProjectInput,
  type ProjectType,
  type PropertyType,
} from '@/lib/projects';
import {
  AnalyticsEvents,
  trackEvent,
  trackLandingEvent,
} from '@/lib/analytics';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
  onSessionExpired?: () => void;
  /**
   * Draft to prefill the form with — a project the visitor already started.
   * Keep the object stable across renders: it is snapshotted when the modal opens.
   */
  initialDraft?: CreateProjectInput | null;
  /**
   * Called instead of creating when the visitor is not signed in: the caller
   * starts the project anonymously and navigates to it. Registering happens
   * later, when the project is published for bids.
   */
  onCreateGuestProject?: (input: CreateProjectInput) => Promise<void> | void;
  /**
   * Called instead of creating when the signed-in user has no client role, so
   * the caller can offer to add it.
   */
  onRequireClientRole?: (input: CreateProjectInput) => void;
}

const DEFAULT_CONSTRUCTION_TYPE: ProjectType = 'renovation';

/** Elements that can hold focus inside the dialog, for the Tab trap. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
  onSessionExpired,
  initialDraft = null,
  onCreateGuestProject,
  onRequireClientRole,
}: CreateProjectModalProps) {
  const { t } = useTranslation();
  const { formatProjectType } = useAppFormatters();
  const { me, ready: sessionReady } = useSession();
  const { confirm, dialog } = useConfirmDialog();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectTrack, setProjectTrack] = useState<ProjectTrack>('construction');
  const [projectType, setProjectType] = useState<ProjectType>(
    DEFAULT_CONSTRUCTION_TYPE,
  );
  const [propertyType, setPropertyType] = useState<PropertyType | ''>('');
  const [locationCatalog, setLocationCatalog] = useState<LocationCatalog | null>(
    null,
  );
  const [locationRegionSlug, setLocationRegionSlug] = useState(
    DEFAULT_SERVICE_LOCATION.regionSlug,
  );
  const [locationAreaSlug, setLocationAreaSlug] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [clarificationMode, setClarificationMode] =
    useState<ClarificationMode>('open_chat');
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<CreateProjectField, CreateProjectFieldError>>
  >({});
  const [creating, setCreating] = useState(false);

  /** Blocks a second submit before `creating` is on screen (double click). */
  const submitLocked = useRef(false);
  /** Whether the visitor changed anything after the form opened. */
  const touchedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const propertySelectRef = useRef<HTMLSelectElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Snapshot the draft once per open: reading `initialDraft` here without
    // listing it as a dependency keeps a parent re-render from wiping what the
    // user is typing.
    const draft = initialDraft;
    setRestoredDraft(Boolean(draft));

    setTitle(draft?.title ?? '');
    setDescription(draft?.description ?? '');
    setProjectTrack(draft?.projectType === 'design' ? 'design' : 'construction');
    setProjectType(
      draft?.projectType && draft.projectType !== 'design'
        ? draft.projectType
        : DEFAULT_CONSTRUCTION_TYPE,
    );
    setPropertyType(draft?.propertyType ?? '');
    setLocationRegionSlug(
      draft?.locationRegionSlug || DEFAULT_SERVICE_LOCATION.regionSlug,
    );
    setLocationAreaSlug(draft?.locationAreaSlug ?? '');
    setLocationNote(draft?.locationNote ?? '');
    setClarificationMode(draft?.clarificationMode ?? 'open_chat');
    setError(null);
    setFieldErrors({});
    touchedRef.current = false;

    void fetchLocationCatalog()
      .then((catalog) => {
        setLocationCatalog(catalog);
        setLocationRegionSlug(
          draft?.locationRegionSlug || catalog.defaultRegionSlug,
        );
      })
      .catch(() => setLocationCatalog(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /**
   * Opening puts the cursor where the visitor wants to start — the project itself.
   * Closing returns focus to the trigger, so keyboard users are not dropped at the
   * top of the page.
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const frame = window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      restoreFocusRef.current?.focus();
    };
  }, [isOpen]);

  const markTouched = () => {
    touchedRef.current = true;
  };

  const isDirty = hasUnsavedCreateProjectInput({
    title,
    description,
    propertyType,
    locationAreaSlug,
    locationNote,
  });

  /**
   * Close only when nothing would be lost. A stray tap on the backdrop — common on
   * a phone — used to discard a half-written description without a word.
   */
  const requestClose = useCallback(async () => {
    if (creating) {
      return;
    }
    // A restored draft is already persisted in this browser, so closing it loses
    // nothing until the visitor starts editing.
    if (!isDirty || !touchedRef.current) {
      onClose();
      return;
    }

    const discard = await confirm({
      title: t('createProject.closeConfirmTitle'),
      message: t('createProject.closeConfirmMessage'),
      confirmLabel: t('createProject.closeConfirmDiscard'),
      cancelLabel: t('createProject.closeConfirmKeep'),
      tone: 'danger',
    });

    if (discard) {
      onClose();
    }
  }, [confirm, creating, isDirty, onClose, t]);

  /** Escape closes the form — the same path as the × button (with confirmation). */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void requestClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, requestClose]);

  /**
   * Keep Tab inside the dialog while it is open; otherwise focus walks into the
   * page behind the overlay, which screen-reader and keyboard users cannot see.
   */
  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') {
      return;
    }

    const container = dialogRef.current;
    if (!container) {
      return;
    }

    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((element) => element.offsetParent !== null || element === document.activeElement);

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === container)) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) {
    return null;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const handleTrackChange = (track: ProjectTrack) => {
    setProjectTrack(track);
    if (track === 'design') {
      setProjectType('design');
      return;
    }
    if (projectType === 'design') {
      setProjectType(DEFAULT_CONSTRUCTION_TYPE);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    // A second click can land before React re-renders the disabled button, which
    // used to create the same project twice (two cards, two estimates).
    if (submitLocked.current) {
      return;
    }

    const validation = validateCreateProjectForm({ title, propertyType });
    setFieldErrors(validation);

    if (Object.keys(validation).length > 0) {
      // Move focus to the first problem instead of leaving the visitor to hunt for
      // the reason nothing happened.
      const target = firstInvalidField(validation);
      if (target === 'title') {
        titleInputRef.current?.focus();
      } else if (target === 'propertyType') {
        propertySelectRef.current?.focus();
      }
      return;
    }

    submitLocked.current = true;

    // `validateCreateProjectForm` already rejected an empty value; this guard is
    // what lets the compiler narrow `propertyType` to PropertyType below.
    if (!propertyType) {
      submitLocked.current = false;
      propertySelectRef.current?.focus();
      return;
    }

    const resolvedProjectType: ProjectType =
      projectTrack === 'design' ? 'design' : projectType;
    const input: CreateProjectInput = {
      title,
      description: description.trim() || undefined,
      projectType: resolvedProjectType,
      propertyType,
      locationRegionSlug,
      locationAreaSlug: locationAreaSlug || undefined,
      locationNote: locationNote.trim() || undefined,
      clarificationMode,
    };

    // Anyone may fill the form. Without an account the project is created
    // anonymously and stays in this browser until the visitor registers, which
    // publishing for bids requires. Without the client role, the caller offers
    // to add it first.
    if (!me && onCreateGuestProject) {
      setCreating(true);
      try {
        await onCreateGuestProject(input);
        // The ad funnel's first product step: a guest accepted the value offer and
        // started a project. Tracked with the campaign from the landing context.
        trackLandingEvent(AnalyticsEvents.estimateStarted, {
          mode: 'guest',
          project_type: resolvedProjectType,
          property_type: propertyType,
        });
        onClose();
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : t('createProject.createFailed'),
        );
      } finally {
        setCreating(false);
        submitLocked.current = false;
      }
      return;
    }

    if (me && !canCreateProject(me) && onRequireClientRole) {
      submitLocked.current = false;
      onRequireClientRole(input);
      return;
    }

    setCreating(true);
    try {
      const sessionOk = await ensureSessionFresh();
      if (!sessionOk) {
        setError(t('createProject.sessionExpired'));
        onSessionExpired?.();
        return;
      }

      const project = await createProject(input);
      trackEvent(AnalyticsEvents.createProject, {
        project_id: project.id,
        project_type: resolvedProjectType,
        property_type: propertyType,
        clarification_mode: clarificationMode,
        location_region: locationRegionSlug,
      });
      trackLandingEvent(AnalyticsEvents.estimateStarted, {
        mode: 'client',
        project_id: project.id,
        project_type: resolvedProjectType,
        property_type: propertyType,
      });
      onCreated(project.id);
      onClose();
    } catch (err: unknown) {
      if (isSessionExpiredError(err)) {
        setError(t('createProject.sessionExpired'));
        onSessionExpired?.();
        return;
      }
      setError(
        err instanceof Error ? err.message : t('createProject.createFailed'),
      );
    } finally {
      setCreating(false);
      submitLocked.current = false;
    }
  };

  const fieldErrorText = (field: CreateProjectField): string | null => {
    const code = fieldErrors[field];
    return code ? t(`createProject.${code}`) : null;
  };

  const titleError = fieldErrorText('title');
  const propertyTypeError = fieldErrorText('propertyType');

  const trackOptions = PROJECT_TRACKS;
  const clarificationOptions = CLARIFICATION_MODE_OPTIONS.map(
    (option) => option.value,
  );

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          void requestClose();
        }
      }}
    >
      <div
        className="modal create-project-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        aria-describedby="create-project-subtitle"
        ref={dialogRef}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="modal-header">
          <h2 id="create-project-title">{t('createProject.title')}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t('common.close')}
            onClick={() => void requestClose()}
          >
            ×
          </button>
        </div>

        <p className="muted modal-subtitle" id="create-project-subtitle">
          {t('createProject.subtitle')}
        </p>

        {restoredDraft && (
          <p className="muted create-project-draft-note">
            {t('createProject.draftRestored')}
          </p>
        )}

        <form onSubmit={handleSubmit} className="modal-form" noValidate>
          <section className="create-project-section">
            <h3 className="create-project-section-title">
              {t('createProject.sectionBasics')}
            </h3>

            <label>
              {t('createProject.titleLabel')}
              <input
                type="text"
                ref={titleInputRef}
                value={title}
                onChange={(e) => {
                  markTouched();
                  setTitle(e.target.value);
                  if (fieldErrors.title) {
                    setFieldErrors((current) => {
                      const { title: _omit, ...rest } = current;
                      return rest;
                    });
                  }
                }}
                placeholder={t('createProject.titlePlaceholder')}
                aria-invalid={titleError ? true : undefined}
                aria-describedby={titleError ? 'create-project-title-error' : undefined}
                required
                minLength={3}
              />
              {titleError && (
                <span className="form-error" id="create-project-title-error" role="alert">
                  {titleError}
                </span>
              )}
            </label>

            <label>
              {t('createProject.descriptionLabel')}
              <textarea
                value={description}
                onChange={(e) => {
                  markTouched();
                  setDescription(e.target.value);
                }}
                placeholder={t('createProject.descriptionPlaceholder')}
                aria-describedby="create-project-description-hint"
                rows={4}
              />
              <span
                className="field-hint muted"
                id="create-project-description-hint"
              >
                {t('createProject.descriptionHint')}
              </span>
            </label>

            <div className="clarification-mode-field">
              <span className="clarification-mode-label" id="create-project-track-label">
                {t('filters.projectTrackLabel')}
              </span>
              <div
                className="clarification-mode-switch"
                role="radiogroup"
                aria-labelledby="create-project-track-label"
                onKeyDown={(event) => {
                  const next = radioValueForKey(
                    trackOptions,
                    projectTrack,
                    event.key,
                  );
                  if (!next) return;
                  event.preventDefault();
                  handleTrackChange(next);
                }}
              >
                {trackOptions.map((track) => {
                  const active = projectTrack === track;
                  return (
                    <button
                      key={track}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      tabIndex={active ? 0 : -1}
                      className={`clarification-mode-switch-btn${
                        active ? ' clarification-mode-switch-btn--active' : ''
                      }`}
                      onClick={() => handleTrackChange(track)}
                    >
                      {t(projectTrackI18nKey(track))}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="create-project-section">
            <h3 className="create-project-section-title">
              {t('createProject.sectionDetails')}
            </h3>

            <label>
              {t('createProject.propertyTypeLabel')}
              <select
                ref={propertySelectRef}
                value={propertyType}
                onChange={(e) => {
                  markTouched();
                  setPropertyType(e.target.value as PropertyType | '');
                  if (fieldErrors.propertyType) {
                    setFieldErrors((current) => {
                      const { propertyType: _omit, ...rest } = current;
                      return rest;
                    });
                  }
                }}
                aria-invalid={propertyTypeError ? true : undefined}
                aria-describedby={
                  propertyTypeError ? 'create-project-property-error' : undefined
                }
                required
              >
                <option value="" disabled>
                  {t('createProject.selectPropertyType')}
                </option>
                {PROPERTY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(propertyTypeFilterI18nKey(option.value))}
                  </option>
                ))}
              </select>
              {propertyTypeError && (
                <span
                  className="form-error"
                  id="create-project-property-error"
                  role="alert"
                >
                  {propertyTypeError}
                </span>
              )}
            </label>

            {projectTrack === 'construction' && (
              <label>
                {t('createProject.projectTypeLabel')}
                <select
                  value={projectType}
                  onChange={(e) =>
                    setProjectType(e.target.value as ProjectType)
                  }
                >
                  {CONSTRUCTION_PROJECT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {formatProjectType(option.value)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {projectTrack === 'construction' && projectType === 'new_build' && (
              <div className="create-project-design-hint" role="note">
                <p className="create-project-design-hint-text">
                  {t('createProject.newBuildDesignHint')}
                </p>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleTrackChange('design')}
                >
                  {t('createProject.switchToDesignTrack')}
                </button>
              </div>
            )}
          </section>

          <section className="create-project-section">
            <h3 className="create-project-section-title">
              {t('createProject.sectionLocation')}
            </h3>

            {locationCatalog ? (
              <ProjectLocationFields
                catalog={locationCatalog}
                regionSlug={locationRegionSlug}
                areaSlug={locationAreaSlug}
                note={locationNote}
                disabled={creating}
                onRegionChange={(value) => {
                  markTouched();
                  setLocationRegionSlug(value);
                }}
                onAreaChange={(value) => {
                  markTouched();
                  setLocationAreaSlug(value);
                }}
                onNoteChange={(value) => {
                  markTouched();
                  setLocationNote(value);
                }}
              />
            ) : (
              /**
               * Skeleton instead of "Loading locations…": the text used to push the
               * rest of the form down when the catalogue arrived.
               */
              <div
                className="create-project-location-skeleton"
                aria-hidden
              >
                <span className="skeleton-field" />
                <span className="skeleton-field" />
                <span className="skeleton-field skeleton-field--wide" />
              </div>
            )}
          </section>

          <details className="create-project-advanced">
            <summary className="create-project-advanced-summary">
              {t('createProject.advancedClarification')}
            </summary>
            <div className="clarification-mode-field">
              <span
                className="clarification-mode-label"
                id="create-project-clarification-label"
              >
                {t(
                  projectType === 'design'
                    ? 'createProject.clarificationLabelDesign'
                    : 'createProject.clarificationLabel',
                )}
              </span>
              <p className="muted clarification-mode-hint">
                {t(
                  projectType === 'design'
                    ? 'createProject.clarificationHintDesign'
                    : 'createProject.clarificationHint',
                )}
              </p>
              <div
                className="clarification-mode-switch"
                role="radiogroup"
                aria-labelledby="create-project-clarification-label"
                onKeyDown={(event) => {
                  const next = radioValueForKey(
                    clarificationOptions,
                    clarificationMode,
                    event.key,
                  );
                  if (!next) return;
                  event.preventDefault();
                  setClarificationMode(next);
                }}
              >
                {CLARIFICATION_MODE_OPTIONS.map((option) => {
                  const active = clarificationMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      tabIndex={active ? 0 : -1}
                      className={`clarification-mode-switch-btn${
                        active ? ' clarification-mode-switch-btn--active' : ''
                      }`}
                      onClick={() => setClarificationMode(option.value)}
                    >
                      {t(`clarificationMode.${option.value}`)}
                    </button>
                  );
                })}
              </div>
              <p className="muted clarification-mode-desc">
                {t(`clarificationMode.${clarificationMode}_desc`)}
              </p>
            </div>
          </details>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="row create-project-actions">
            <button
              type="submit"
              className="primary create-project-submit"
              disabled={creating || !sessionReady}
            >
              {creating
                ? t('createProject.creating')
                : t('createProject.createButton')}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void requestClose()}
              disabled={creating}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
      {dialog}
    </div>,
    document.body,
  );
}

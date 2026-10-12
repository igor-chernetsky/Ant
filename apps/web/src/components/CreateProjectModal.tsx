'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ProjectLocationFields } from '@/components/ProjectLocationFields';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { isSessionExpiredError } from '@/lib/auth-client';
import {
  DEFAULT_SERVICE_LOCATION,
  fetchLocationCatalog,
  type LocationCatalog,
} from '@/lib/locations';
import { savePendingProjectDraft } from '@/lib/pending-project-draft';
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
import { AnalyticsEvents, trackEvent } from '@/lib/analytics';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
  onSessionExpired?: () => void;
  /**
   * Draft to prefill the form with — a project the visitor filled in before
   * signing up, restored after registration. Keep the object stable across
   * renders: it is snapshotted when the modal opens.
   */
  initialDraft?: CreateProjectInput | null;
  /**
   * Called instead of creating when the visitor is not signed in. The caller
   * opens the registration dialog and keeps the draft until it is published.
   */
  onRequireAccount?: (input: CreateProjectInput) => void;
  /**
   * Called instead of creating when the signed-in user has no client role, so
   * the caller can offer to add it.
   */
  onRequireClientRole?: (input: CreateProjectInput) => void;
}

const DEFAULT_CONSTRUCTION_TYPE: ProjectType = 'renovation';

export function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
  onSessionExpired,
  initialDraft = null,
  onRequireAccount,
  onRequireClientRole,
}: CreateProjectModalProps) {
  const { t } = useTranslation();
  const { formatProjectType } = useAppFormatters();
  const { me, ready: sessionReady } = useSession();
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
  const [creating, setCreating] = useState(false);

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

    if (!propertyType) {
      setError(t('createProject.propertyTypeRequired'));
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

    // Anyone may fill the form. Publishing it needs an account, and publishing
    // it as a client needs the client role — the caller opens the matching
    // dialog and comes back with the draft. Without a caller for that, fall
    // through so the API answers with a real error instead of doing nothing.
    if (!me && onRequireAccount) {
      savePendingProjectDraft(input);
      onRequireAccount(input);
      return;
    }

    if (me && !canCreateProject(me) && onRequireClientRole) {
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
    }
  };

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal create-project-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
      >
        <div className="modal-header">
          <h2 id="create-project-title">{t('createProject.title')}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="muted modal-subtitle">{t('createProject.subtitle')}</p>

        {restoredDraft && (
          <p className="muted create-project-draft-note">
            {t('createProject.draftRestored')}
          </p>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="clarification-mode-field">
            <span className="clarification-mode-label">
              {t('filters.projectTrackLabel')}
            </span>
            <div
              className="clarification-mode-switch"
              role="radiogroup"
              aria-label={t('filters.projectTrackAria')}
            >
              {PROJECT_TRACKS.map((track) => (
                <button
                  key={track}
                  type="button"
                  role="radio"
                  aria-checked={projectTrack === track}
                  className={`clarification-mode-switch-btn${
                    projectTrack === track
                      ? ' clarification-mode-switch-btn--active'
                      : ''
                  }`}
                  onClick={() => handleTrackChange(track)}
                >
                  {t(projectTrackI18nKey(track))}
                </button>
              ))}
            </div>
          </div>

          <label>
            {t('createProject.propertyTypeLabel')}
            <select
              value={propertyType}
              onChange={(e) =>
                setPropertyType(e.target.value as PropertyType | '')
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
            <div
              className="create-project-design-hint"
              role="note"
            >
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

          <label>
            {t('createProject.titleLabel')}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('createProject.titlePlaceholder')}
              required
              minLength={3}
            />
          </label>
          <label>
            {t('createProject.descriptionLabel')}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('createProject.descriptionPlaceholder')}
              rows={4}
            />
          </label>
          {locationCatalog ? (
            <ProjectLocationFields
              catalog={locationCatalog}
              regionSlug={locationRegionSlug}
              areaSlug={locationAreaSlug}
              note={locationNote}
              disabled={creating}
              onRegionChange={setLocationRegionSlug}
              onAreaChange={setLocationAreaSlug}
              onNoteChange={setLocationNote}
            />
          ) : (
            <p className="muted">{t('createProject.loadingLocations')}</p>
          )}

          <div className="clarification-mode-field">
            <span className="clarification-mode-label">
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
              aria-label={t(
                projectType === 'design'
                  ? 'createProject.clarificationAriaDesign'
                  : 'createProject.clarificationAria',
              )}
            >
              {CLARIFICATION_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={clarificationMode === option.value}
                  className={`clarification-mode-switch-btn${
                    clarificationMode === option.value
                      ? ' clarification-mode-switch-btn--active'
                      : ''
                  }`}
                  onClick={() => setClarificationMode(option.value)}
                >
                  {t(`clarificationMode.${option.value}`)}
                </button>
              ))}
            </div>
            <p className="muted clarification-mode-desc">
              {t(`clarificationMode.${clarificationMode}_desc`)}
            </p>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="row">
            <button
              type="submit"
              className="primary"
              disabled={
                creating ||
                !sessionReady ||
                title.trim().length < 3 ||
                propertyType === ''
              }
            >
              {creating ? t('createProject.creating') : t('createProject.createButton')}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              disabled={creating}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

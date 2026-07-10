'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ProjectLocationFields } from '@/components/ProjectLocationFields';
import { useTranslation } from '@/components/LocaleProvider';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import { isSessionExpiredError } from '@/lib/auth-client';
import {
  DEFAULT_SERVICE_LOCATION,
  fetchLocationCatalog,
  type LocationCatalog,
} from '@/lib/locations';
import { ensureSessionFresh } from '@/lib/session';
import {
  CLARIFICATION_MODE_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  createProject,
  type ClarificationMode,
  type ProjectType,
  type PropertyType,
} from '@/lib/projects';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
  onSessionExpired?: () => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
  onSessionExpired,
}: CreateProjectModalProps) {
  const { t } = useTranslation();
  const { formatProjectType, formatPropertyType } = useAppFormatters();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('renovation');
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
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void ensureSessionFresh();
    void fetchLocationCatalog()
      .then((catalog) => {
        setLocationCatalog(catalog);
        setLocationRegionSlug(catalog.defaultRegionSlug);
      })
      .catch(() => setLocationCatalog(null));
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const sessionOk = await ensureSessionFresh();
      if (!sessionOk) {
        setError(t('createProject.sessionExpired'));
        onSessionExpired?.();
        return;
      }

      const project = await createProject({
        title,
        description: description.trim() || undefined,
        projectType,
        propertyType: propertyType || undefined,
        locationRegionSlug,
        locationAreaSlug: locationAreaSlug || undefined,
        locationNote: locationNote.trim() || undefined,
        clarificationMode,
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

  return (
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
        className="modal"
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

        <form onSubmit={handleSubmit} className="modal-form">
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
          <div className="form-row">
            <label>
              {t('createProject.projectTypeLabel')}
              <select
                value={projectType}
                onChange={(e) =>
                  setProjectType(e.target.value as ProjectType)
                }
              >
                {PROJECT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {formatProjectType(option.value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('createProject.propertyTypeLabel')}
              <select
                value={propertyType}
                onChange={(e) =>
                  setPropertyType(e.target.value as PropertyType | '')
                }
              >
                <option value="">{t('createProject.notSpecified')}</option>
                {PROPERTY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {formatPropertyType(option.value)}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
              {t('createProject.clarificationLabel')}
            </span>
            <p className="muted clarification-mode-hint">
              {t('createProject.clarificationHint')}
            </p>
            <div
              className="clarification-mode-switch"
              role="radiogroup"
              aria-label={t('createProject.clarificationAria')}
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
              disabled={creating || title.trim().length < 3}
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
    </div>
  );
}

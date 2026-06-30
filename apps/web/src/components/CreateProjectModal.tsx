'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ProjectLocationFields } from '@/components/ProjectLocationFields';
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
        setError('Your session expired. Please sign in again.');
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
        setError('Your session expired. Please sign in again.');
        onSessionExpired?.();
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to create project');
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
          <h2 id="create-project-title">New project</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="muted modal-subtitle">
          AI will refine the description and suggest tags after creation.
        </p>

        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kitchen renovation"
              required
              minLength={3}
            />
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe scope, materials, timeline…"
              rows={4}
            />
          </label>
          <div className="form-row">
            <label>
              Project type
              <select
                value={projectType}
                onChange={(e) =>
                  setProjectType(e.target.value as ProjectType)
                }
              >
                {PROJECT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Property type
              <select
                value={propertyType}
                onChange={(e) =>
                  setPropertyType(e.target.value as PropertyType | '')
                }
              >
                <option value="">Not specified</option>
                {PROPERTY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
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
            <p className="muted">Loading locations…</p>
          )}

          <div className="clarification-mode-field">
            <span className="clarification-mode-label">Contractor clarification</span>
            <p className="muted clarification-mode-hint">
              How contractors ask questions before submitting proposals.
            </p>
            <div
              className="clarification-mode-switch"
              role="radiogroup"
              aria-label="Contractor clarification"
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
                  {option.label}
                </button>
              ))}
            </div>
            <p className="muted clarification-mode-desc">
              {
                CLARIFICATION_MODE_OPTIONS.find(
                  (option) => option.value === clarificationMode,
                )?.description
              }
            </p>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="row">
            <button
              type="submit"
              className="primary"
              disabled={creating || title.trim().length < 3}
            >
              {creating ? 'Creating…' : 'Create project'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

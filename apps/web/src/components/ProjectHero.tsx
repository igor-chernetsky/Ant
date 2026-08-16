'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import { ProjectLocationMap } from '@/components/ProjectLocationMap';
import { ProjectStageRail } from '@/components/ProjectStageRail';
import { useAppFormatters } from '@/hooks/useAppFormatters';
import {
  canEditConstructionProjectType,
  CONSTRUCTION_PROJECT_TYPE_OPTIONS,
  convertProjectToDesign,
  formatDateTime,
  PROPERTY_TYPE_OPTIONS,
  resumeConstructionFromDesign,
  resumePendingProject,
  updateProjectCard,
  type Project,
  type ProjectTag,
  type ProjectType,
  type PropertyType,
} from '@/lib/projects';

interface ProjectHeroProps {
  project: Project;
  estimateMidAmountThb?: number | null;
  tags?: ProjectTag[];
  showTags?: boolean;
  tagsHint?: string | null;
  canEditCard?: boolean;
  onCardUpdated?: (project: Project) => void;
  /** When set, renders the project stage progress inside the hero. */
  stageStatus?: string | null;
}

const DESIGN_HINT_TYPES = new Set([
  'new_build',
  'extension',
  'commercial_fitout',
  'modernization_reconstruction',
  'repair',
]);

export function ProjectHeroSidebar({
  project,
  estimateMidAmountThb,
  tags = [],
  showTags = false,
  tagsHint = null,
}: Pick<
  ProjectHeroProps,
  'project' | 'estimateMidAmountThb' | 'tags' | 'showTags' | 'tagsHint'
>) {
  const { t, locale } = useTranslation();
  const { formatProjectStatus, formatTagLabel } = useAppFormatters();
  const isDesignTrack = project.projectType === 'design';

  return (
    <aside className="project-hero-aside project-hero-sidebar-card">
      <span className="status-pill status-pill-lg project-hero-status">
        {project.isHidden
          ? t('projectHero.hidden')
          : formatProjectStatus(project.status)}
      </span>
      <div className="project-hero-aside-metrics">
        <span className="readiness-badge readiness-badge-lg project-hero-readiness">
          {t('projectHero.readyPercent', { n: project.readinessScore })}
        </span>
        {typeof estimateMidAmountThb === 'number' && estimateMidAmountThb > 0 && (
          <p className="project-hero-meta">
            {isDesignTrack
              ? t('projectHero.designBallparkMidpoint')
              : t('projectHero.ballparkMidpoint')}
            &nbsp;
            <span className="project-hero-meta-value">
              {new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: 'THB',
                maximumFractionDigits: 0,
              }).format(estimateMidAmountThb)}
            </span>
          </p>
        )}
        {typeof estimateMidAmountThb === 'number' && estimateMidAmountThb > 0 && (
          <p className="project-hero-meta muted project-hero-ballpark-note">
            {t('projectHero.ballparkExcludesAdjustments')}
          </p>
        )}
      </div>
      {showTags && tags.length > 0 && (
        <div className="project-hero-tags">
          <p className="project-hero-tags-label">{t('projectHero.scopeTags')}</p>
          <div
            className="project-hero-tag-list"
            aria-label={t('projectHero.scopeTagsAria')}
          >
            {tags.map((tag) => (
              <span
                key={tag.slug}
                className={`tag-pill${
                  tag.source === 'client' ? ' tag-pill-client' : ' tag-pill-ai'
                }`}
                title={
                  tag.source === 'client'
                    ? t('projectHero.tagSelectedDuringIntake')
                    : t('projectHero.tagSuggestedByAi')
                }
              >
                {formatTagLabel(tag.slug, tag.label)}
              </span>
            ))}
          </div>
          {tagsHint && (
            <p className="project-hero-tags-hint muted">{tagsHint}</p>
          )}
        </div>
      )}
      {project.locationRegionSlug ? (
        <ProjectLocationMap
          regionSlug={project.locationRegionSlug}
          areaSlug={project.locationAreaSlug}
          caption={project.district}
        />
      ) : null}
    </aside>
  );
}

export function ProjectHero({
  project,
  estimateMidAmountThb,
  tags = [],
  showTags = false,
  tagsHint = null,
  canEditCard = false,
  onCardUpdated,
  stageStatus = null,
  /** When false, only the main title/description column is rendered. */
  includeSidebar = true,
}: ProjectHeroProps & { includeSidebar?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { formatProjectType, formatPropertyType } = useAppFormatters();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? '');
  const [propertyType, setPropertyType] = useState<PropertyType | ''>(
    project.propertyType ?? '',
  );
  const [projectType, setProjectType] = useState<ProjectType>(
    project.projectType,
  );
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDesignTrack = project.projectType === 'design';
  const isNewBuild = project.projectType === 'new_build';
  const showDesignHint =
    canEditCard &&
    !isDesignTrack &&
    DESIGN_HINT_TYPES.has(project.projectType);
  const designConvertHintKey = isNewBuild
    ? 'designPermits.convertHintNewBuild'
    : 'designPermits.convertHint';
  const canConvert = Boolean(canEditCard && project.canConvertToDesign);
  const canResume = Boolean(canEditCard && project.status === 'pending');
  const canResumeConstruction = Boolean(
    canEditCard && project.canResumeConstruction,
  );
  const canEditType = Boolean(
    canEditCard && canEditConstructionProjectType(project),
  );

  useEffect(() => {
    if (!editing) {
      setTitle(project.title);
      setDescription(project.description ?? '');
      setPropertyType(project.propertyType ?? '');
      setProjectType(project.projectType);
      setError(null);
    }
  }, [
    project.title,
    project.description,
    project.propertyType,
    project.projectType,
    editing,
  ]);

  const chips = [
    formatProjectType(project.projectType),
    formatPropertyType(project.propertyType),
    project.district,
    project.regionCode,
  ].filter((value) => value && value !== t('common.dash'));

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (nextTitle.length < 3) {
      setError(t('projectHero.editTitleTooShort'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateProjectCard(project.id, {
        title: nextTitle,
        description: description.trim() || null,
        propertyType: propertyType || null,
        ...(canEditType ? { projectType } : {}),
      });
      onCardUpdated?.(updated);
      setEditing(false);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t('projectHero.editSaveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTitle(project.title);
    setDescription(project.description ?? '');
    setPropertyType(project.propertyType ?? '');
    setProjectType(project.projectType);
    setError(null);
    setEditing(false);
  };

  const handleConvert = async () => {
    setConverting(true);
    setError(null);
    try {
      const updated = await convertProjectToDesign(project.id);
      onCardUpdated?.(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('designPermits.convertFailed'),
      );
    } finally {
      setConverting(false);
    }
  };

  const handleResume = async () => {
    setConverting(true);
    setError(null);
    try {
      const updated = await resumePendingProject(project.id);
      onCardUpdated?.(updated);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('designPermits.resumeFailed'),
      );
    } finally {
      setConverting(false);
    }
  };

  const handleResumeConstruction = async () => {
    setConverting(true);
    setError(null);
    try {
      const construction = await resumeConstructionFromDesign(project.id);
      router.push(`/projects/${construction.id}`);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('designPermits.resumeConstructionFailed'),
      );
    } finally {
      setConverting(false);
    }
  };

  return (
    <section
      className={`project-hero${includeSidebar ? '' : ' project-hero--main-only'}`}
      aria-labelledby="project-hero-title"
    >
      <div className="project-hero-body">
        <div className="project-hero-main">
          <p className="project-hero-kicker">
            <Link href="/" className="project-hero-back-link">
              {t('projectHero.projectsBreadcrumb')}
            </Link>
          </p>

          {isDesignTrack && (
            <p className="project-hero-track-label">
              {t('designPermits.trackLabel')}
            </p>
          )}

          {editing ? (
            <form className="project-hero-edit" onSubmit={handleSave}>
              <label className="project-hero-edit-label">
                {t('projectHero.editTitleLabel')}
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  disabled={saving}
                  required
                  autoFocus
                />
              </label>
              <label className="project-hero-edit-label">
                {t('projectHero.editDescriptionLabel')}
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={20000}
                  disabled={saving}
                />
              </label>
              <div className="project-hero-edit-type-row">
                <label className="project-hero-edit-label">
                  {t('createProject.propertyTypeLabel')}
                  <select
                    value={propertyType}
                    onChange={(e) =>
                      setPropertyType(e.target.value as PropertyType | '')
                    }
                    disabled={saving}
                  >
                    <option value="">{t('createProject.notSpecified')}</option>
                    {PROPERTY_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {formatPropertyType(option.value)}
                      </option>
                    ))}
                  </select>
                </label>
                {canEditType && (
                  <label className="project-hero-edit-label">
                    {t('createProject.projectTypeLabel')}
                    <select
                      value={projectType}
                      onChange={(e) =>
                        setProjectType(e.target.value as ProjectType)
                      }
                      disabled={saving}
                    >
                      {CONSTRUCTION_PROJECT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {formatProjectType(option.value)}
                        </option>
                      ))}
                      {!CONSTRUCTION_PROJECT_TYPE_OPTIONS.some(
                        (option) => option.value === projectType,
                      ) && (
                        <option value={projectType}>
                          {formatProjectType(projectType)}
                        </option>
                      )}
                    </select>
                  </label>
                )}
              </div>
              {canEditType && (
                <p className="muted project-hero-edit-field-hint">
                  {t('projectHero.editProjectTypeHint')}
                </p>
              )}
              {error && (
                <p className="project-hero-edit-error" role="alert">
                  {error}
                </p>
              )}
              <p className="muted project-hero-edit-hint">
                {t('projectHero.editKpHint')}
              </p>
              <div className="project-hero-edit-actions">
                <button type="submit" className="primary" disabled={saving}>
                  {saving ? t('common.saving') : t('common.save')}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="project-hero-title-row">
                <h1 id="project-hero-title">{project.title}</h1>
                {canEditCard && (
                  <button
                    type="button"
                    className="ghost project-hero-edit-trigger"
                    onClick={() => setEditing(true)}
                  >
                    {t('projectHero.editCard')}
                  </button>
                )}
              </div>
              {project.description ? (
                <p className="project-hero-lead">{project.description}</p>
              ) : (
                <p className="project-hero-lead project-hero-lead-muted">
                  {t('projectHero.noDescription')}
                </p>
              )}
            </>
          )}

          {(canConvert ||
            canResume ||
            canResumeConstruction ||
            showDesignHint ||
            project.linkedProjectId) && (
            <div className="project-hero-design-actions">
              {showDesignHint && (
                <p
                  className={`muted project-hero-design-hint${
                    isNewBuild ? ' project-hero-design-hint--new-build' : ''
                  }`}
                  title={t('designPermits.convertTooltip')}
                >
                  {t(designConvertHintKey)}
                </p>
              )}
              {canConvert && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void handleConvert()}
                  disabled={converting || saving}
                  title={t('designPermits.convertTooltip')}
                >
                  {converting
                    ? t('common.saving')
                    : t('designPermits.convertButton')}
                </button>
              )}
              {canResumeConstruction && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => void handleResumeConstruction()}
                  disabled={converting || saving}
                  title={t('designPermits.resumeConstructionTooltip')}
                >
                  {converting
                    ? t('common.saving')
                    : t('designPermits.resumeConstructionButton')}
                </button>
              )}
              {canResume && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => void handleResume()}
                  disabled={converting || saving}
                >
                  {converting
                    ? t('common.saving')
                    : t('designPermits.resumeButton')}
                </button>
              )}
              {project.linkedProjectId && (
                <Link
                  href={`/projects/${project.linkedProjectId}`}
                  className="project-hero-linked"
                >
                  {project.linkKind === 'design_active'
                    ? t('designPermits.linkedConstruction')
                    : t('designPermits.linkedDesign')}
                </Link>
              )}
              {error && !editing && (
                <p className="project-hero-edit-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}

          {chips.length > 0 && (
            <ul
              className="project-hero-chips"
              aria-label={t('projectHero.highlightsAria')}
            >
              {chips.map((chip) => (
                <li key={chip}>{chip}</li>
              ))}
            </ul>
          )}
          <p className="muted project-hero-timestamps">
            {t('projectHero.created')} {formatDateTime(project.createdAt)}
            {' · '}
            {t('projectHero.updated')} {formatDateTime(project.updatedAt)}
          </p>

          {stageStatus ? (
            <div className="project-hero-stage">
              <ProjectStageRail status={stageStatus} />
            </div>
          ) : null}
        </div>
        {includeSidebar && (
          <ProjectHeroSidebar
            project={project}
            estimateMidAmountThb={estimateMidAmountThb}
            tags={tags}
            showTags={showTags}
            tagsHint={tagsHint}
          />
        )}
      </div>
    </section>
  );
}

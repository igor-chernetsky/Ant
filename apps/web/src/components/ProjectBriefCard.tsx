'use client';

import { useTranslation } from '@/components/LocaleProvider';
import { MetaSpecGrid, type MetaSpecItem } from '@/components/MetaSpecGrid';
import type { ProjectBriefV1 } from '@/lib/projects';

interface ProjectBriefCardProps {
  brief: ProjectBriefV1;
  compact?: boolean;
}

export function ProjectBriefCard({
  brief,
  compact = false,
}: ProjectBriefCardProps) {
  const { t } = useTranslation();

  const propertyItems: MetaSpecItem[] = brief.property
    ? [
        ...(brief.property.areaSqm != null
          ? [
              {
                label: t('brief.floorArea'),
                value: `${brief.property.areaSqm} ${t('brief.sqm')}`,
              },
            ]
          : []),
        ...(brief.property.floors != null
          ? [{ label: t('brief.floors'), value: String(brief.property.floors) }]
          : []),
        ...(brief.property.rooms != null
          ? [{ label: t('brief.rooms'), value: String(brief.property.rooms) }]
          : []),
      ]
    : [];

  const designItems: MetaSpecItem[] = brief.design
    ? [
        {
          label: t('brief.plansAvailable'),
          value: brief.design.hasPlans ? t('brief.yes') : t('brief.no'),
        },
        {
          label: t('brief.designTenderNeeded'),
          value: brief.design.needsDesignTender ? t('brief.yes') : t('brief.no'),
        },
      ]
    : [];

  const hasBody =
    Boolean(brief.summary) ||
    propertyItems.length > 0 ||
    designItems.length > 0 ||
    Boolean(brief.constraints) ||
    Boolean(brief.ai?.missingFields?.length);

  if (!hasBody) return null;

  return (
    <section
      className={`card project-brief-card${compact ? ' project-brief-card--compact' : ''}`}
    >
      <h2 className="section-title">{t('brief.title')}</h2>

      {brief.summary && <p className="brief-lead">{brief.summary}</p>}

      {propertyItems.length > 0 && (
        <div className="brief-subsection">
          <h3 className="brief-subsection-title">{t('brief.propertyDetails')}</h3>
          <MetaSpecGrid items={propertyItems} />
        </div>
      )}

      {designItems.length > 0 && (
        <div className="brief-subsection">
          <h3 className="brief-subsection-title">{t('brief.designPlans')}</h3>
          <MetaSpecGrid items={designItems} className="brief-meta" />
        </div>
      )}

      {brief.constraints && (
        <div className="brief-subsection">
          <h3 className="brief-subsection-title">{t('brief.constraints')}</h3>
          <MetaSpecGrid
            items={[
              {
                label: t('brief.notes'),
                value: brief.constraints,
                fullWidth: true,
              },
            ]}
          />
        </div>
      )}

      {brief.ai?.missingFields && brief.ai.missingFields.length > 0 && (
        <div className="brief-callout">
          <p className="brief-callout-title">{t('brief.stillNeeded')}</p>
          <ul className="brief-missing-list">
            {brief.ai.missingFields.map((field) => (
              <li key={field}>{field.replaceAll('_', ' ')}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

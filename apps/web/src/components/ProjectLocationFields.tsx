'use client';

import { useTranslation } from '@/components/LocaleProvider';
import type { LocationCatalog } from '@/lib/locations';
import { areasForRegion } from '@/lib/locations';

interface ProjectLocationFieldsProps {
  catalog: LocationCatalog;
  regionSlug: string;
  areaSlug: string;
  note: string;
  onRegionChange: (regionSlug: string) => void;
  onAreaChange: (areaSlug: string) => void;
  onNoteChange: (note: string) => void;
  disabled?: boolean;
}

export function ProjectLocationFields({
  catalog,
  regionSlug,
  areaSlug,
  note,
  onRegionChange,
  onAreaChange,
  onNoteChange,
  disabled = false,
}: ProjectLocationFieldsProps) {
  const { t } = useTranslation();
  const areas = areasForRegion(catalog, regionSlug);

  return (
    <>
      <div className="form-row">
        <label>
          {t('location.region')}
          <select
            value={regionSlug}
            disabled={disabled}
            onChange={(e) => {
              onRegionChange(e.target.value);
              onAreaChange('');
            }}
          >
            {catalog.regions.map((region) => (
              <option key={region.slug} value={region.slug}>
                {region.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('location.area')}
          <select
            value={areaSlug}
            disabled={disabled || areas.length === 0}
            onChange={(e) => onAreaChange(e.target.value)}
          >
            <option value="">{t('common.wholeRegion')}</option>
            {areas.map((area) => (
              <option key={area.slug} value={area.slug}>
                {area.label}
              </option>
            ))}
          </select>
          <span className="field-hint muted">{t('location.areaHint')}</span>
        </label>
      </div>
      <label>
        {t('location.locationNote')}
        <span className="field-hint muted">{t('location.locationNoteHint')}</span>
        <input
          type="text"
          value={note}
          disabled={disabled}
          placeholder={t('location.locationNotePlaceholder')}
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </label>
    </>
  );
}

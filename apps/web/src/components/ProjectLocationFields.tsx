'use client';

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
  const areas = areasForRegion(catalog, regionSlug);

  return (
    <>
      <div className="form-row">
        <label>
          Region
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
          Area
          <span className="field-hint muted">Optional — narrower zone within the region</span>
          <select
            value={areaSlug}
            disabled={disabled || areas.length === 0}
            onChange={(e) => onAreaChange(e.target.value)}
          >
            <option value="">Whole region</option>
            {areas.map((area) => (
              <option key={area.slug} value={area.slug}>
                {area.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Location note
        <span className="field-hint muted">
          Optional — landmark, BTS station, subdistrict, etc.
        </span>
        <input
          type="text"
          value={note}
          disabled={disabled}
          placeholder="e.g. near BTS Thong Lo"
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </label>
    </>
  );
}

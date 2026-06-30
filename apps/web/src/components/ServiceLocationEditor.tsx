'use client';

import type { LocationCatalog, ServiceLocation } from '@/lib/locations';
import {
  DEFAULT_SERVICE_LOCATION,
  areasForRegion,
  formatServiceLocation,
} from '@/lib/locations';

interface ServiceLocationEditorProps {
  catalog: LocationCatalog;
  value: ServiceLocation[];
  onChange: (next: ServiceLocation[]) => void;
  disabled?: boolean;
}

function locationKey(location: ServiceLocation): string {
  return `${location.regionSlug}::${location.areaSlug ?? '*'}`;
}

export function ServiceLocationEditor({
  catalog,
  value,
  onChange,
  disabled = false,
}: ServiceLocationEditorProps) {
  const locations = value.length > 0 ? value : [DEFAULT_SERVICE_LOCATION];

  const updateAt = (index: number, next: ServiceLocation) => {
    const copy = [...locations];
    copy[index] = next;
    onChange(copy);
  };

  const removeAt = (index: number) => {
    if (locations.length <= 1) {
      onChange([DEFAULT_SERVICE_LOCATION]);
      return;
    }
    onChange(locations.filter((_, i) => i !== index));
  };

  const addLocation = () => {
    const used = new Set(locations.map(locationKey));
    const fallback =
      catalog.regions.find((region) => !used.has(`${region.slug}::*`)) ??
      catalog.regions[0];
    if (!fallback) return;
    onChange([...locations, { regionSlug: fallback.slug }]);
  };

  return (
    <fieldset className="tag-fieldset service-location-fieldset">
      <legend>Service areas</legend>
      <p className="muted tag-hint">
        You will be notified about new projects in these regions and areas.
        Leave area empty to cover the whole region.
      </p>
      <ul className="service-location-list">
        {locations.map((location, index) => {
          const areas = areasForRegion(catalog, location.regionSlug);
          return (
            <li key={`${index}-${locationKey(location)}`} className="service-location-row">
              <div className="form-row">
                <label>
                  Region
                  <select
                    value={location.regionSlug}
                    disabled={disabled}
                    onChange={(e) =>
                      updateAt(index, {
                        regionSlug: e.target.value,
                        areaSlug: undefined,
                      })
                    }
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
                  <select
                    value={location.areaSlug ?? ''}
                    disabled={disabled || areas.length === 0}
                    onChange={(e) =>
                      updateAt(index, {
                        regionSlug: location.regionSlug,
                        areaSlug: e.target.value || undefined,
                      })
                    }
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
              <div className="service-location-row-actions">
                <span className="muted service-location-summary">
                  {formatServiceLocation(catalog, location)}
                </span>
                <button
                  type="button"
                  className="secondary service-location-remove"
                  disabled={disabled || locations.length <= 1}
                  onClick={() => removeAt(index)}
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="secondary"
        disabled={disabled}
        onClick={addLocation}
      >
        Add location
      </button>
    </fieldset>
  );
}

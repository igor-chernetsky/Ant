'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  getGoogleMapsApiKey,
  GOOGLE_MAPS_THEME,
  loadGoogleMapsScript,
  markerIcon,
} from '@/lib/google-maps';
import type { LocationCatalog } from '@/lib/locations';
import { areasForRegion } from '@/lib/locations';

interface LocationSearchMapProps {
  catalog: LocationCatalog;
  regionSlug: string;
  areaSlug: string;
  onRegionChange: (regionSlug: string) => void;
  onAreaChange: (areaSlug: string) => void;
}

const THAILAND_CENTER = { lat: 13.2, lng: 100.5 };
const DEFAULT_ZOOM = 6;

export function LocationSearchMap({
  catalog,
  regionSlug,
  areaSlug,
  onRegionChange,
  onAreaChange,
}: LocationSearchMapProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const onRegionChangeRef = useRef(onRegionChange);
  const onAreaChangeRef = useRef(onAreaChange);
  onRegionChangeRef.current = onRegionChange;
  onAreaChangeRef.current = onAreaChange;
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>(
    () => (getGoogleMapsApiKey() ? 'loading' : 'error'),
  );

  useEffect(() => {
    if (!getGoogleMapsApiKey() || !containerRef.current) {
      return;
    }

    let cancelled = false;

    void loadGoogleMapsScript()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) {
          if (!cancelled) {
            setMapState('ready');
          }
          return;
        }

        mapRef.current = new google.maps.Map(containerRef.current, {
          center: THAILAND_CENTER,
          zoom: DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'cooperative',
          styles: GOOGLE_MAPS_THEME,
        });
        setMapState('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setMapState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapState !== 'ready') {
      return;
    }

    for (const marker of markersRef.current) {
      marker.setMap(null);
    }
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    const nextMarkers: google.maps.Marker[] = [];

    const addMarker = (
      position: google.maps.LatLngLiteral,
      label: string,
      selected: boolean,
      large: boolean,
      onClick: () => void,
    ) => {
      const marker = new google.maps.Marker({
        map,
        position,
        title: label,
        icon: markerIcon(google.maps, selected, large),
        zIndex: selected ? 2 : 1,
      });
      marker.addListener('click', onClick);
      nextMarkers.push(marker);
      bounds.extend(position);
    };

    if (!regionSlug) {
      for (const region of catalog.regions) {
        addMarker(
          { lat: region.lat, lng: region.lng },
          region.label,
          false,
          true,
          () => {
            onRegionChangeRef.current(region.slug);
            onAreaChangeRef.current('');
          },
        );
      }

      for (const area of catalog.areas) {
        addMarker(
          { lat: area.lat, lng: area.lng },
          area.label,
          false,
          false,
          () => {
            onRegionChangeRef.current(area.regionSlug);
            onAreaChangeRef.current(area.slug);
          },
        );
      }

      if (nextMarkers.length > 0) {
        map.fitBounds(bounds, 40);
        google.maps.event.addListenerOnce(map, 'idle', () => {
          const zoom = map.getZoom();
          if (zoom != null && zoom > 7) {
            map.setZoom(7);
          }
        });
      } else {
        map.setCenter(THAILAND_CENTER);
        map.setZoom(DEFAULT_ZOOM);
      }
    } else {
      const region = catalog.regions.find((item) => item.slug === regionSlug);
      const areas = areasForRegion(catalog, regionSlug);

      if (region) {
        addMarker(
          { lat: region.lat, lng: region.lng },
          region.label,
          !areaSlug,
          true,
          () => {
            onRegionChangeRef.current(region.slug);
            onAreaChangeRef.current('');
          },
        );
      }

      for (const area of areas) {
        addMarker(
          { lat: area.lat, lng: area.lng },
          area.label,
          areaSlug === area.slug,
          false,
          () => {
            onRegionChangeRef.current(area.regionSlug);
            onAreaChangeRef.current(area.slug);
          },
        );
      }

      if (nextMarkers.length > 0) {
        map.fitBounds(bounds, 48);
        google.maps.event.addListenerOnce(map, 'idle', () => {
          const zoom = map.getZoom();
          if (zoom != null && zoom > 13) {
            map.setZoom(13);
          }
        });
      }
    }

    markersRef.current = nextMarkers;
  }, [catalog, regionSlug, areaSlug, mapState]);

  if (mapState === 'error') {
    return (
      <div className="project-filters-map project-filters-map--placeholder">
        <p className="muted">{t('filters.mapUnavailable')}</p>
      </div>
    );
  }

  return (
    <div className="project-filters-map-wrap">
      <div
        ref={containerRef}
        className="project-filters-map"
        role="application"
        aria-label={t('filters.mapAria')}
      />
      {mapState === 'loading' && (
        <p className="project-filters-map-loading muted">{t('filters.mapLoading')}</p>
      )}
      <p className="muted project-filters-map-hint">{t('filters.mapHint')}</p>
    </div>
  );
}

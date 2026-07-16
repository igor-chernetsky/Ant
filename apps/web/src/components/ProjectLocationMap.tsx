'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/components/LocaleProvider';
import {
  getGoogleMapsApiKey,
  GOOGLE_MAPS_THEME,
  loadGoogleMapsScript,
  markerIcon,
} from '@/lib/google-maps';
import {
  fetchLocationCatalog,
  type LocationCatalog,
} from '@/lib/locations';

interface ProjectLocationMapProps {
  regionSlug: string;
  areaSlug?: string | null;
  caption?: string | null;
}

function resolvePoint(
  catalog: LocationCatalog,
  regionSlug: string,
  areaSlug?: string | null,
): { lat: number; lng: number; label: string; zoom: number } | null {
  if (areaSlug) {
    const area = catalog.areas.find((item) => item.slug === areaSlug);
    if (area) {
      return {
        lat: area.lat,
        lng: area.lng,
        label: area.label,
        zoom: 13,
      };
    }
  }

  const region = catalog.regions.find((item) => item.slug === regionSlug);
  if (!region) {
    return null;
  }

  return {
    lat: region.lat,
    lng: region.lng,
    label: region.label,
    zoom: 11,
  };
}

export function ProjectLocationMap({
  regionSlug,
  areaSlug = null,
  caption = null,
}: ProjectLocationMapProps) {
  const { t, locale } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [catalog, setCatalog] = useState<LocationCatalog | null>(null);
  const [mapState, setMapState] = useState<'idle' | 'loading' | 'ready' | 'hidden'>(
    'idle',
  );

  useEffect(() => {
    if (!getGoogleMapsApiKey()) {
      setMapState('hidden');
      return;
    }

    let cancelled = false;
    void fetchLocationCatalog()
      .then((next) => {
        if (!cancelled) {
          setCatalog(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMapState('hidden');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const point = useMemo(
    () => (catalog ? resolvePoint(catalog, regionSlug, areaSlug) : null),
    [catalog, regionSlug, areaSlug],
  );

  useEffect(() => {
    if (!getGoogleMapsApiKey() || !point) {
      if (catalog && !point) {
        setMapState('hidden');
      }
      return;
    }

    let cancelled = false;
    setMapState('loading');

    void loadGoogleMapsScript(locale)
      .then(() => {
        if (cancelled || !containerRef.current) {
          return;
        }

        if (markerRef.current) {
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
        mapRef.current = null;

        const map = new google.maps.Map(containerRef.current, {
          center: { lat: point.lat, lng: point.lng },
          zoom: point.zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          clickableIcons: false,
          disableDefaultUI: true,
          gestureHandling: 'none',
          keyboardShortcuts: false,
          styles: GOOGLE_MAPS_THEME,
          draggable: false,
        });
        mapRef.current = map;
        markerRef.current = new google.maps.Marker({
          map,
          position: { lat: point.lat, lng: point.lng },
          title: point.label,
          icon: markerIcon(google.maps, true, true),
          clickable: false,
        });
        setMapState('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setMapState('hidden');
        }
      });

    return () => {
      cancelled = true;
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      mapRef.current = null;
    };
  }, [catalog, locale, point]);

  if (!point || mapState === 'hidden') {
    return null;
  }

  const trimmedCaption = caption?.trim() || null;

  return (
    <div className="project-hero-map">
      <p className="project-hero-map-label">{t('projectHero.locationMap')}</p>
      <div
        ref={containerRef}
        className="project-hero-map-canvas"
        role="img"
        aria-label={
          trimmedCaption
            ? t('projectHero.locationMapAriaNamed', {
                location: trimmedCaption,
              })
            : t('projectHero.locationMapAria')
        }
      />
      {mapState !== 'ready' && (
        <p className="project-hero-map-loading muted">
          {t('filters.mapLoading')}
        </p>
      )}
      {trimmedCaption ? (
        <p className="project-hero-map-caption muted">{trimmedCaption}</p>
      ) : null}
    </div>
  );
}

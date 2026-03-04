import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useMemo, useCallback } from 'react';

interface MapStop {
  lat: number;
  lng: number;
  address: string;
  seq: number;
  status?: 'pending' | 'arrived' | 'done' | 'skipped' | 'failed';
}

interface MapboxViewProps {
  stops: MapStop[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

const statusColors: Record<string, { bg: string; border: string }> = {
  done: { bg: '#22c55e', border: '#16a34a' },
  arrived: { bg: '#8b5cf6', border: '#7c3aed' },
  pending: { bg: '#3b82f6', border: '#2563eb' },
  skipped: { bg: '#f59e0b', border: '#d97706' },
  failed: { bg: '#ef4444', border: '#dc2626' },
};

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    done: 'Completada',
    arrived: 'En sitio',
    pending: 'Pendiente',
    skipped: 'Omitida',
    failed: 'Fallida',
  };
  return labels[status] || 'Pendiente';
}

export function MapboxView({ stops, center, zoom = 12, className = '' }: MapboxViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  const sortedStops = useMemo(
    () => [...stops].sort((a, b) => a.seq - b.seq),
    [stops]
  );

  const clearMarkers = useCallback(() => {
    markers.current.forEach(m => m.remove());
    markers.current = [];
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? '';

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center ? [center.lng, center.lat] : [-77.0428, -12.0464],
      zoom,
      trackResize: true,
      preserveDrawingBuffer: false,
      antialias: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      clearMarkers();
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers & route line when stops change
  useEffect(() => {
    if (!map.current) return;

    clearMarkers();

    sortedStops.forEach((stop) => {
      const status = stop.status || 'pending';
      const colors = statusColors[status] || statusColors.pending;

      const el = document.createElement('div');
      el.className = 'marker';
      el.style.cssText = `
        background: ${colors.bg};
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        border: 3px solid ${colors.border};
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: transform 0.2s;
      `;
      el.textContent = String(stop.seq);

      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([stop.lng, stop.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25, closeButton: false })
            .setHTML(`
              <div style="font-family: system-ui, sans-serif; padding: 4px;">
                <strong>Parada ${stop.seq}</strong>
                <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;color:white;background:${colors.bg};">
                  ${getStatusLabel(status)}
                </span>
                <br/><span style="color:#666;font-size:13px;">${stop.address}</span>
              </div>
            `)
        )
        .addTo(map.current!);

      markers.current.push(marker);
    });

    // Update or create route line
    const updateLine = () => {
      if (!map.current || sortedStops.length < 2) return;

      const coordinates = sortedStops.map(s => [s.lng, s.lat] as [number, number]);
      const geojsonData: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      };

      if (map.current.getSource('route-line')) {
        (map.current.getSource('route-line') as mapboxgl.GeoJSONSource).setData(geojsonData);
      } else {
        map.current.addSource('route-line', { type: 'geojson', data: geojsonData });
        map.current.addLayer({
          id: 'route-line-layer',
          type: 'line',
          source: 'route-line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#6366f1',
            'line-width': 3,
            'line-opacity': 0.6,
            'line-dasharray': [2, 2],
          },
        });
      }
    };

    if (map.current.isStyleLoaded()) {
      updateLine();
    } else {
      map.current.once('load', updateLine);
    }

    // Auto-fit bounds
    if (sortedStops.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      sortedStops.forEach(stop => bounds.extend([stop.lng, stop.lat]));
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
  }, [sortedStops, clearMarkers]);

  return (
    <div
      ref={mapContainer}
      className={`rounded-lg overflow-hidden ${className}`}
      style={{ width: '100%', height: '100%', minHeight: '400px' }}
    />
  );
}

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (!mapContainer.current) return;
    
    mapboxgl.accessToken = 'pk.eyJ1Ijoid2lsbHBzODQiLCJhIjoiY21sYjUxZXZ3MG4zcjNycTBvMWZ5ZGh3OSJ9.JvfwdqhWlRi2D_1D8xSzww';
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center ? [center.lng, center.lat] : [-77.0428, -12.0464],
      zoom: zoom
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    stops.forEach((stop) => {
      const status = stop.status || 'pending';
      const colors = statusColors[status] || statusColors.pending;
      
      const el = document.createElement('div');
      el.className = 'marker';
      el.innerHTML = `<div style="
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
      ">${stop.seq}</div>`;
      
      el.addEventListener('mouseenter', () => {
        (el.firstChild as HTMLElement).style.transform = 'scale(1.2)';
      });
      el.addEventListener('mouseleave', () => {
        (el.firstChild as HTMLElement).style.transform = 'scale(1)';
      });
      
      new mapboxgl.Marker(el)
        .setLngLat([stop.lng, stop.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div style="font-family: system-ui, sans-serif;">
                <strong>Parada ${stop.seq}</strong>
                <span style="
                  display: inline-block;
                  margin-left: 6px;
                  padding: 1px 6px;
                  border-radius: 9999px;
                  font-size: 11px;
                  font-weight: 600;
                  color: white;
                  background: ${colors.bg};
                ">${getStatusLabel(status)}</span>
                <br/><span style="color:#555; font-size:13px;">${stop.address}</span>
              </div>
            `)
        )
        .addTo(map.current!);
    });
    
    // Draw polyline connecting stops in order
    map.current.on('load', () => {
      if (!map.current || stops.length < 2) return;
      
      const sorted = [...stops].sort((a, b) => a.seq - b.seq);
      const coordinates = sorted.map(s => [s.lng, s.lat] as [number, number]);
      
      map.current.addSource('route-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates,
          },
        },
      });
      
      map.current.addLayer({
        id: 'route-line-layer',
        type: 'line',
        source: 'route-line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#6366f1',
          'line-width': 3,
          'line-opacity': 0.6,
          'line-dasharray': [2, 2],
        },
      });
    });
    
    // Auto-fit bounds
    if (stops.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      stops.forEach(stop => bounds.extend([stop.lng, stop.lat]));
      map.current.fitBounds(bounds, { padding: 50 });
    }
    
    return () => map.current?.remove();
  }, [stops, center, zoom]);
  
  return (
    <div 
      ref={mapContainer} 
      className={`rounded-lg overflow-hidden ${className}`}
      style={{ width: '100%', height: '100%', minHeight: '400px' }} 
    />
  );
}

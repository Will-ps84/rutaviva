import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';

interface DriverLocation {
  driver_id: string;
  driver_name: string | null;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading: number | null;
  recorded_at: string;
  route_id: string | null;
}

interface RealtimeMapViewProps {
  drivers: DriverLocation[];
  className?: string;
}

// Calculate status based on age
function getDriverStatus(recordedAt: string): 'active' | 'stopped' | 'noSignal' {
  const age = (Date.now() - new Date(recordedAt).getTime()) / 1000;
  if (age < 60) return 'active';
  if (age < 300) return 'stopped';
  return 'noSignal';
}

// Status colors
const statusColors = {
  active: '#22c55e',    // green
  stopped: '#eab308',   // yellow
  noSignal: '#6b7280',  // gray
};

export function RealtimeMapView({ drivers, className = '' }: RealtimeMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = 'pk.eyJ1Ijoid2lsbHBzODQiLCJhIjoiY21sYjUxZXZ3MG4zcjNycTBvMWZ5ZGh3OSJ9.JvfwdqhWlRi2D_1D8xSzww';

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-77.0428, -12.0464], // Lima, Peru default
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update markers when drivers change
  useEffect(() => {
    if (!map.current) return;

    const currentDriverIds = new Set(drivers.map((d) => d.driver_id));

    // Remove markers for drivers no longer in the list
    markers.current.forEach((marker, driverId) => {
      if (!currentDriverIds.has(driverId)) {
        marker.remove();
        markers.current.delete(driverId);
      }
    });

    // Update or create markers
    drivers.forEach((driver) => {
      const status = getDriverStatus(driver.recorded_at);
      const color = statusColors[status];
      const speedKmh = driver.speed_mps ? (driver.speed_mps * 3.6).toFixed(0) : '0';
      const age = Math.round((Date.now() - new Date(driver.recorded_at).getTime()) / 1000);
      const ageText = age < 60 ? `${age}s` : age < 3600 ? `${Math.round(age / 60)}m` : `${Math.round(age / 3600)}h`;

      const existingMarker = markers.current.get(driver.driver_id);

      if (existingMarker) {
        // Update existing marker position
        existingMarker.setLngLat([driver.lng, driver.lat]);
        
        // Update popup content
        existingMarker.setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="min-width: 150px;">
              <strong>${driver.driver_name || 'Conductor'}</strong><br/>
              <span style="color: ${color}; font-weight: bold;">● ${status === 'active' ? 'Activo' : status === 'stopped' ? 'Detenido' : 'Sin señal'}</span><br/>
              <small>Velocidad: ${speedKmh} km/h</small><br/>
              <small>Última actualización: hace ${ageText}</small>
            </div>
          `)
        );

        // Update marker color
        const el = existingMarker.getElement();
        const innerDiv = el.querySelector('div');
        if (innerDiv) {
          (innerDiv as HTMLElement).style.background = color;
        }
      } else {
        // Create new marker
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.innerHTML = `
          <div style="
            background: ${color};
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.1.2-.1.5-.1.7v4.6c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
        `;

        const marker = new mapboxgl.Marker(el)
          .setLngLat([driver.lng, driver.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="min-width: 150px;">
                <strong>${driver.driver_name || 'Conductor'}</strong><br/>
                <span style="color: ${color}; font-weight: bold;">● ${status === 'active' ? 'Activo' : status === 'stopped' ? 'Detenido' : 'Sin señal'}</span><br/>
                <small>Velocidad: ${speedKmh} km/h</small><br/>
                <small>Última actualización: hace ${ageText}</small>
              </div>
            `)
          )
          .addTo(map.current!);

        markers.current.set(driver.driver_id, marker);
      }
    });

    // Fit bounds to show all markers
    if (drivers.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      drivers.forEach((d) => bounds.extend([d.lng, d.lat]));
      
      // Only fit bounds if there are multiple drivers or first load
      if (drivers.length > 1) {
        map.current.fitBounds(bounds, { padding: 80, maxZoom: 15 });
      } else if (drivers.length === 1) {
        map.current.flyTo({ center: [drivers[0].lng, drivers[0].lat], zoom: 14 });
      }
    }
  }, [drivers]);

  return (
    <div
      ref={mapContainer}
      className={`rounded-lg overflow-hidden ${className}`}
      style={{ width: '100%', height: '100%', minHeight: '400px' }}
    />
  );
}

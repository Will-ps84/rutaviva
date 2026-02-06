import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';

interface MapboxViewProps {
  stops: Array<{ lat: number; lng: number; address: string; seq: number }>;
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

export function MapboxView({ stops, center, zoom = 12, className = '' }: MapboxViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    
    // Use VITE_MAPBOX_TOKEN (the secret we configured)
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    
    if (!token) {
      console.error('Mapbox token not found. Please set VITE_MAPBOX_TOKEN');
      return;
    }
    
    mapboxgl.accessToken = token;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center ? [center.lng, center.lat] : [-77.0428, -12.0464],
      zoom: zoom
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Agregar pines numerados
    stops.forEach((stop) => {
      const el = document.createElement('div');
      el.className = 'marker';
      el.innerHTML = `<div style="
        background: hsl(var(--primary));
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${stop.seq}</div>`;
      
      new mapboxgl.Marker(el)
        .setLngLat([stop.lng, stop.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<strong>Parada ${stop.seq}</strong><br/>${stop.address}`)
        )
        .addTo(map.current!);
    });
    
    // Auto-ajustar zoom para ver todos los pines
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

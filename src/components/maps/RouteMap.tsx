import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Stop {
  id: string;
  seq: number;
  address_text: string;
  lat: number | null;
  lng: number | null;
  status: string;
}

interface RouteMapProps {
  stops: Stop[];
  className?: string;
  onStopClick?: (stop: Stop) => void;
}

// Mapbox public token - safe to use in frontend
const MAPBOX_TOKEN = 'pk.eyJ1IjoicnV0YXZpdmEiLCJhIjoiY200cWd4cWx4MGt0azJxcHdtOHV5NHVrYSJ9.placeholder';

export function RouteMap({ stops, className = '', onStopClick }: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  const validStops = stops.filter(s => s.lat !== null && s.lng !== null);

  // Calculate center
  let centerLat = -12.0464;
  let centerLng = -77.0428;
  
  if (validStops.length > 0) {
    const sumLat = validStops.reduce((sum, s) => sum + s.lat!, 0);
    const sumLng = validStops.reduce((sum, s) => sum + s.lng!, 0);
    centerLat = sumLat / validStops.length;
    centerLng = sumLng / validStops.length;
  }

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Check for token
    const token = import.meta.env.VITE_MAPBOX_TOKEN || MAPBOX_TOKEN;
    
    if (!token || token.includes('placeholder')) {
      setMapError('Token de Mapbox no configurado');
      return;
    }

    try {
      mapboxgl.accessToken = token;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [centerLng, centerLat],
        zoom: validStops.length > 0 ? 13 : 12,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add markers for stops
      validStops.forEach((stop) => {
        const el = document.createElement('div');
        el.className = 'mapbox-marker';
        el.innerHTML = `
          <div style="
            width: 28px;
            height: 28px;
            background: hsl(var(--primary));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer;
          ">${stop.seq}</div>
        `;

        if (onStopClick) {
          el.addEventListener('click', () => onStopClick(stop));
        }

        const marker = new mapboxgl.Marker(el)
          .setLngLat([stop.lng!, stop.lat!])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div style="padding: 4px;">
                  <strong>#${stop.seq}</strong><br/>
                  <span style="font-size: 12px;">${stop.address_text}</span>
                </div>
              `)
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
      });

      // Fit bounds if multiple stops
      if (validStops.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        validStops.forEach(stop => {
          bounds.extend([stop.lng!, stop.lat!]);
        });
        map.current.fitBounds(bounds, { padding: 50 });
      }
    } catch (error) {
      console.error('Error initializing Mapbox:', error);
      setMapError('Error al cargar el mapa');
    }

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [centerLat, centerLng, validStops, onStopClick]);

  // Update markers when stops change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    validStops.forEach((stop) => {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          width: 28px;
          height: 28px;
          background: hsl(var(--primary));
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
        ">${stop.seq}</div>
      `;

      if (onStopClick) {
        el.addEventListener('click', () => onStopClick(stop));
      }

      const marker = new mapboxgl.Marker(el)
        .setLngLat([stop.lng!, stop.lat!])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div style="padding: 4px;">
                <strong>#${stop.seq}</strong><br/>
                <span style="font-size: 12px;">${stop.address_text}</span>
              </div>
            `)
        )
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Fit bounds
    if (validStops.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      validStops.forEach(stop => {
        bounds.extend([stop.lng!, stop.lat!]);
      });
      map.current.fitBounds(bounds, { padding: 50 });
    } else if (validStops.length === 1) {
      map.current.flyTo({
        center: [validStops[0].lng!, validStops[0].lat!],
        zoom: 15,
      });
    }
  }, [stops]);

  if (mapError) {
    return (
      <div className={`relative h-full w-full rounded-lg overflow-hidden bg-muted flex items-center justify-center ${className}`} style={{ minHeight: '300px' }}>
        <div className="text-center p-6">
          <p className="text-muted-foreground mb-2">{mapError}</p>
          <p className="text-xs text-muted-foreground">
            Configura VITE_MAPBOX_TOKEN en las variables de entorno
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full rounded-lg overflow-hidden ${className}`} style={{ minHeight: '300px' }}>
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Stop list overlay */}
      {validStops.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 shadow-lg max-h-32 overflow-y-auto scrollbar-thin">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {validStops.length} parada{validStops.length !== 1 ? 's' : ''} en el mapa
          </p>
          <div className="flex flex-wrap gap-2">
            {validStops.map((stop) => (
              <div
                key={stop.id}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${
                  stop.status === 'done' 
                    ? 'bg-[hsl(var(--status-active-bg))] text-[hsl(var(--status-active))]' 
                    : stop.status === 'arrived' 
                      ? 'bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning))]' 
                      : 'bg-secondary text-secondary-foreground'
                }`}
                onClick={() => onStopClick?.(stop)}
              >
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                  {stop.seq}
                </span>
                <span className="truncate max-w-[120px]">{stop.address_text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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

// Custom numbered marker icon
function createNumberedIcon(number: number, status: string): L.DivIcon {
  const color = status === 'done' ? '#22c55e' : status === 'arrived' ? '#f59e0b' : '#3b82f6';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${number}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Component to fit bounds when stops change
function FitBounds({ stops }: { stops: Stop[] }) {
  const map = useMap();
  const hasSetBounds = useRef(false);
  
  useEffect(() => {
    const validStops = stops.filter(s => s.lat !== null && s.lng !== null);
    
    if (validStops.length > 0 && !hasSetBounds.current) {
      const bounds = L.latLngBounds(
        validStops.map(s => [s.lat!, s.lng!] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
      hasSetBounds.current = true;
    }
  }, [stops, map]);
  
  return null;
}

export function RouteMap({ stops, className = '', onStopClick }: RouteMapProps) {
  // Default center: Lima, Peru
  const defaultCenter: [number, number] = [-12.0464, -77.0428];
  
  const validStops = stops.filter(s => s.lat !== null && s.lng !== null);
  
  return (
    <MapContainer
      center={defaultCenter}
      zoom={12}
      className={`h-full w-full rounded-lg ${className}`}
      style={{ minHeight: '300px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <FitBounds stops={stops} />
      
      {validStops.map((stop) => (
        <Marker
          key={stop.id}
          position={[stop.lat!, stop.lng!]}
          icon={createNumberedIcon(stop.seq, stop.status)}
          eventHandlers={{
            click: () => onStopClick?.(stop),
          }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">Parada #{stop.seq}</p>
              <p className="text-muted-foreground">{stop.address_text}</p>
              <p className="mt-1">
                <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                  stop.status === 'done' ? 'bg-green-100 text-green-800' :
                  stop.status === 'arrived' ? 'bg-amber-100 text-amber-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {stop.status === 'done' ? 'Completado' : 
                   stop.status === 'arrived' ? 'En sitio' : 
                   stop.status === 'skipped' ? 'Omitido' : 'Pendiente'}
                </span>
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

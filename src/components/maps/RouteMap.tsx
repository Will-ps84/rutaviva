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

export function RouteMap({ stops, className = '' }: RouteMapProps) {
  // Calculate center from stops or use Lima, Peru as default
  const validStops = stops.filter(s => s.lat !== null && s.lng !== null);
  
  let centerLat = -12.0464;
  let centerLng = -77.0428;
  let zoom = 12;
  
  if (validStops.length > 0) {
    // Calculate center of all stops
    const sumLat = validStops.reduce((sum, s) => sum + s.lat!, 0);
    const sumLng = validStops.reduce((sum, s) => sum + s.lng!, 0);
    centerLat = sumLat / validStops.length;
    centerLng = sumLng / validStops.length;
    zoom = 14;
  }

  // Build markers parameter for Google Maps
  const markersParam = validStops
    .map(s => `markers=color:blue%7Clabel:${s.seq}%7C${s.lat},${s.lng}`)
    .join('&');

  // Google Maps Embed URL (static map view)
  const mapUrl = `https://www.google.com/maps/embed/v1/view?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&center=${centerLat},${centerLng}&zoom=${zoom}`;

  return (
    <div className={`relative h-full w-full rounded-lg overflow-hidden ${className}`} style={{ minHeight: '300px' }}>
      <iframe
        width="100%"
        height="100%"
        style={{ border: 0, minHeight: '300px' }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={mapUrl}
        title="Mapa de ruta"
      />
      
      {/* Overlay with stop list for interaction */}
      {validStops.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 shadow-lg max-h-32 overflow-y-auto scrollbar-thin">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {validStops.length} parada{validStops.length !== 1 ? 's' : ''} en el mapa
          </p>
          <div className="flex flex-wrap gap-2">
            {validStops.map((stop) => (
              <div
                key={stop.id}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                  stop.status === 'done' 
                    ? 'bg-[hsl(var(--status-active-bg))] text-[hsl(var(--status-active))]' 
                    : stop.status === 'arrived' 
                      ? 'bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning))]' 
                      : 'bg-secondary text-secondary-foreground'
                }`}
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

import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Clock, Truck, Package, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TrackingStop {
  id: string;
  address_text: string;
  status: string;
  tracking_token: string;
  route_id: string;
  lat: number | null;
  lng: number | null;
  recipient_name: string | null;
  failure_reason: string | null;
}

interface TrackingRoute {
  id: string;
  name: string;
  status: string;
  driver_id: string | null;
  company_id: string;
}

interface TrackingProfile {
  id: string;
  full_name: string | null;
}

interface TrackingCompany {
  id: string;
  name: string;
}

interface DriverLocation {
  lat: number;
  lng: number;
  speed_mps: number | null;
  recorded_at: string;
}

function getStatusInfo(status: string) {
  switch (status) {
    case 'done': return { label: '✅ Entregado', color: 'bg-[hsl(var(--status-active))]', description: 'Tu pedido fue entregado correctamente.' };
    case 'failed': return { label: '❌ No entregado', color: 'bg-destructive', description: 'No se pudo completar la entrega.' };
    case 'skipped': return { label: '⏭️ Omitido', color: 'bg-[hsl(var(--status-warning))]', description: 'La entrega fue omitida en esta ruta.' };
    case 'arrived': return { label: '📍 El conductor llegó', color: 'bg-primary', description: 'El conductor está en tu dirección ahora.' };
    default: return { label: '🚚 En camino', color: 'bg-primary', description: 'Tu pedido está en camino.' };
  }
}

function calcETA(driverLat: number, driverLng: number, destLat: number, destLng: number, speedMps: number | null): string {
  const R = 6371000;
  const dLat = (destLat - driverLat) * Math.PI / 180;
  const dLng = (destLng - driverLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(driverLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const distanceM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const speed = speedMps && speedMps > 1 ? speedMps : 8.33; // default 30km/h
  const etaMin = Math.round(distanceM / speed / 60);
  if (etaMin < 1) return 'Menos de 1 min';
  if (etaMin < 60) return `${etaMin} min`;
  return `${Math.floor(etaMin / 60)}h ${etaMin % 60}min`;
}

export default function Track() {
  const { token } = useParams<{ token: string }>();
  const [stop, setStop] = useState<TrackingStop | null>(null);
  const [route, setRoute] = useState<TrackingRoute | null>(null);
  const [driver, setDriver] = useState<TrackingProfile | null>(null);
  const [company, setCompany] = useState<TrackingCompany | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);

  // Fetch stop by token
  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }

    const load = async () => {
      // 1. Get stop by tracking_token
      const { data: stopData, error: stopErr } = await supabase
        .from('route_stops')
        .select('id, address_text, status, tracking_token, route_id, lat, lng, recipient_name, failure_reason')
        .eq('tracking_token', token)
        .single();

      if (stopErr || !stopData) { setNotFound(true); setLoading(false); return; }
      setStop(stopData as TrackingStop);

      // 2. Get route
      const { data: routeData } = await supabase
        .from('routes')
        .select('id, name, status, driver_id, company_id')
        .eq('id', stopData.route_id)
        .single();

      if (routeData) {
        setRoute(routeData as TrackingRoute);

        // 3. Get driver name
        if (routeData.driver_id) {
          const { data: driverData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', routeData.driver_id)
            .single();
          if (driverData) setDriver(driverData as TrackingProfile);
        }

        // 4. Get company name
        const { data: companyData } = await supabase
          .from('companies')
          .select('id, name')
          .eq('id', routeData.company_id)
          .single();
        if (companyData) setCompany(companyData as TrackingCompany);

        // 5. Get latest driver location
        if (routeData.driver_id) {
          const { data: locData } = await supabase
            .from('location_points')
            .select('lat, lng, speed_mps, recorded_at')
            .eq('route_id', stopData.route_id)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .single();
          if (locData) setDriverLocation({ lat: Number(locData.lat), lng: Number(locData.lng), speed_mps: locData.speed_mps ? Number(locData.speed_mps) : null, recorded_at: locData.recorded_at });
        }
      }

      setLoading(false);
    };

    load();
  }, [token]);

  // Realtime driver location
  useEffect(() => {
    if (!route?.id) return;
    const channel = supabase
      .channel(`track-${route.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'location_points', filter: `route_id=eq.${route.id}` }, (payload) => {
        const p = payload.new as Record<string, unknown>;
        setDriverLocation({ lat: Number(p.lat), lng: Number(p.lng), speed_mps: p.speed_mps ? Number(p.speed_mps) : null, recorded_at: p.recorded_at as string });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [route?.id]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || !stop?.lat || !stop?.lng) return;
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? '';
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [stop.lng, stop.lat],
      zoom: 14,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Destination marker
    const destEl = document.createElement('div');
    destEl.innerHTML = `<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">🏠</div>`;
    destMarker.current = new mapboxgl.Marker(destEl)
      .setLngLat([stop.lng, stop.lat])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(stop.address_text))
      .addTo(map.current);

    return () => { map.current?.remove(); map.current = null; };
  }, [stop]);

  // Update driver marker
  useEffect(() => {
    if (!map.current || !driverLocation) return;

    if (driverMarker.current) {
      driverMarker.current.setLngLat([driverLocation.lng, driverLocation.lat]);
    } else {
      const driverEl = document.createElement('div');
      driverEl.innerHTML = `<div style="font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3));animation:pulse 2s infinite">🚚</div>`;
      driverMarker.current = new mapboxgl.Marker(driverEl)
        .setLngLat([driverLocation.lng, driverLocation.lat])
        .addTo(map.current);
    }

    // Draw dotted line if we have destination
    if (stop?.lat && stop?.lng && map.current.isStyleLoaded()) {
      const lineSource = map.current.getSource('driver-to-dest') as mapboxgl.GeoJSONSource;
      const lineData: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [[driverLocation.lng, driverLocation.lat], [stop.lng, stop.lat]] },
      };
      if (lineSource) {
        lineSource.setData(lineData);
      } else {
        map.current.addSource('driver-to-dest', { type: 'geojson', data: lineData });
        map.current.addLayer({
          id: 'driver-to-dest-line',
          type: 'line',
          source: 'driver-to-dest',
          paint: { 'line-color': 'hsl(224, 89%, 50%)', 'line-width': 2, 'line-dasharray': [2, 3] },
        });
      }
    }

    // Fit bounds to show both markers
    if (stop?.lat && stop?.lng) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([driverLocation.lng, driverLocation.lat]);
      bounds.extend([stop.lng, stop.lat]);
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 16 });
    }
  }, [driverLocation, stop]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !stop) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold">No encontramos tu entrega</h1>
          <p className="text-muted-foreground">El link de seguimiento no es válido o ha expirado.</p>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(stop.status);
  const isCompleted = ['done', 'failed', 'skipped'].includes(stop.status);
  const routeIsLive = route?.status === 'in_progress';
  const eta = driverLocation && stop.lat && stop.lng
    ? calcETA(driverLocation.lat, driverLocation.lng, stop.lat, stop.lng, driverLocation.speed_mps)
    : null;

  const ageMin = driverLocation
    ? Math.round((Date.now() - new Date(driverLocation.recorded_at).getTime()) / 60000)
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">Seguimiento de entrega</h1>
            <p className="text-sm opacity-80">{company?.name || 'RutaViva'}</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Status card */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full ${statusInfo.color} flex items-center justify-center text-white text-2xl`}>
                {stop.status === 'done' ? '✅' : stop.status === 'failed' ? '❌' : '🚚'}
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">{statusInfo.label}</p>
                <p className="text-sm text-muted-foreground">{statusInfo.description}</p>
                {stop.recipient_name && (
                  <p className="text-sm font-medium mt-1">Para: {stop.recipient_name}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ETA card — only when route is live */}
        {routeIsLive && driverLocation && !isCompleted && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Tiempo estimado de llegada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-2">
                <p className="text-4xl font-display font-bold text-primary">{eta || '—'}</p>
                {ageMin !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Última señal: hace {ageMin < 1 ? 'menos de 1 min' : `${ageMin} min`}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Map */}
        {stop.lat && stop.lng ? (
          <Card className="overflow-hidden">
            <div ref={mapContainer} style={{ width: '100%', height: 280 }} />
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Mapa no disponible</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery address */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Información de entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Dirección</p>
              <p className="font-medium">{stop.address_text}</p>
            </div>
            {route?.name && (
              <div>
                <p className="text-xs text-muted-foreground">Ruta</p>
                <p className="text-sm">{route.name}</p>
              </div>
            )}
            {driver?.full_name && (
              <div>
                <p className="text-xs text-muted-foreground">Conductor</p>
                <p className="text-sm">{driver.full_name}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground/40 pb-4">
          Powered by RutaViva
        </p>
      </div>
    </div>
  );
}

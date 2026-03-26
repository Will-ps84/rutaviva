import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Clock, Truck, Package, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

function parseCoords(stop: TrackingStop): { lat: number; lng: number } | null {
  if (stop.lat && stop.lng) {
    return { lat: Number(stop.lat), lng: Number(stop.lng) };
  }
  const match = stop.address_text?.match(/Lat:\s*([-\d.]+),\s*Lng:\s*([-\d.]+)/i);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return null;
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
    case 'pending':  return { label: '🚚 En camino',               color: 'bg-primary',                        description: 'Tu pedido está en camino.' };
    case 'arrived':  return { label: '📍 El conductor está cerca',  color: 'bg-primary',                        description: 'El conductor ya está en tu dirección.' };
    case 'done':     return { label: '✅ Entregado',                color: 'bg-[hsl(var(--status-active))]',    description: 'Tu pedido fue entregado correctamente.' };
    case 'failed':   return { label: '❌ No se pudo entregar',      color: 'bg-destructive',                    description: 'No se pudo completar la entrega.' };
    case 'skipped':  return { label: '⏭️ Omitido',                  color: 'bg-[hsl(var(--status-warning))]',   description: 'La entrega fue omitida en esta ruta.' };
    default:         return { label: '🚚 En camino',               color: 'bg-primary',                        description: 'Tu pedido está en camino.' };
  }
}

function calcETA(driverLat: number, driverLng: number, destLat: number, destLng: number, speedMps: number | null): string {
  const R = 6371000;
  const dLat = (destLat - driverLat) * Math.PI / 180;
  const dLng = (destLng - driverLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(driverLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const distanceM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const speed = speedMps && speedMps > 1 ? speedMps : 8.33;
  const etaMin = Math.round(distanceM / speed / 60);
  if (etaMin < 1) return 'Menos de 1 min';
  if (etaMin < 60) return `${etaMin} min`;
  return `${Math.floor(etaMin / 60)}h ${etaMin % 60}min`;
}

function TrackingMap({ lat, lng }: { lat: number; lng: number; address: string }) {
  const googleMapsUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  return (
    <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', height: '300px' }}>
      <iframe
        title="Ubicación de entrega"
        width="100%"
        height="300"
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={googleMapsUrl}
      />
    </div>
  );
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

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }

    const load = async () => {
      const { data: stopData, error: stopErr } = await supabase
        .from('route_stops')
        .select('id, address_text, status, tracking_token, route_id, lat, lng, recipient_name, failure_reason')
        .eq('tracking_token', token)
        .single();

      if (stopErr || !stopData) { setNotFound(true); setLoading(false); return; }
      setStop(stopData as TrackingStop);

      const { data: routeData } = await supabase
        .from('routes')
        .select('id, name, status, driver_id, company_id')
        .eq('id', stopData.route_id)
        .single();

      if (routeData) {
        setRoute(routeData as TrackingRoute);

        if (routeData.driver_id) {
          const { data: driverData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', routeData.driver_id)
            .single();
          if (driverData) setDriver(driverData as TrackingProfile);
        }

        const { data: companyData } = await supabase
          .from('companies')
          .select('id, name')
          .eq('id', routeData.company_id)
          .single();
        if (companyData) setCompany(companyData as TrackingCompany);

        if (routeData.driver_id) {
          const { data: locData } = await supabase
            .from('location_points')
            .select('lat, lng, speed_mps, recorded_at')
            .eq('route_id', stopData.route_id)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle();
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
  const coords = parseCoords(stop);
  const eta = driverLocation && coords
    ? calcETA(driverLocation.lat, driverLocation.lng, coords.lat, coords.lng, driverLocation.speed_mps)
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
                {stop.failure_reason && stop.status === 'failed' && (
                  <p className="text-sm text-destructive mt-1">Motivo: {stop.failure_reason}</p>
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
        <Card className="overflow-hidden">
          {coords ? (
            <TrackingMap lat={coords.lat} lng={coords.lng} address={stop.address_text} />
          ) : (
            <CardContent className="py-8 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">📍 {stop.address_text}</p>
                <p className="text-xs mt-1 opacity-60">Mapa no disponible</p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Delivery info */}
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

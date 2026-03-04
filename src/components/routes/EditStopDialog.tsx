import { useState, useEffect, useRef } from 'react';
import { Pencil, MapPin, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { geocodeAddress, isValidPeruCoords } from '@/services/geocoding';
import { useUpdateRouteStop, type RouteStop } from '@/hooks/useRoutes';
import { toast } from '@/hooks/use-toast';
import mapboxgl from 'mapbox-gl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? '';

interface EditStopDialogProps {
  stop: RouteStop;
  disabled?: boolean;
}

export function EditStopDialog({ stop, disabled }: EditStopDialogProps) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(stop.address_text);
  const [lat, setLat] = useState<number | null>(stop.lat);
  const [lng, setLng] = useState<number | null>(stop.lng);
  const [geocoding, setGeocoding] = useState(false);
  const updateStop = useUpdateRouteStop();

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setAddress(stop.address_text);
      setLat(stop.lat);
      setLng(stop.lng);
    }
  }, [open, stop]);

  // Mini map
  useEffect(() => {
    if (!open || !mapContainer.current || lat === null || lng === null) return;

    // Clean up previous
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: 14,
      interactive: true,
    });

    const marker = new mapboxgl.Marker({ color: '#3b82f6' })
      .setLngLat([lng, lat])
      .addTo(map);

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [open, lat, lng]);

  const handleReGeocode = async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    try {
      const result = await geocodeAddress(address);
      if (result) {
        setLat(result.lat);
        setLng(result.lng);
        if (isValidPeruCoords(result.lat, result.lng)) {
          toast({ title: '✅ Ubicación encontrada en Perú' });
        } else {
          toast({ title: '⚠️ Ubicación fuera de Perú', description: 'Verifica si es correcta.', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Sin resultados', description: 'Intenta con más detalles (distrito, ciudad).', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error al geocodificar', variant: 'destructive' });
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = () => {
    if (lat === null || lng === null) return;

    updateStop.mutate(
      {
        id: stop.id,
        route_id: stop.route_id,
        address_text: address.trim(),
        lat,
        lng,
      },
      {
        onSuccess: () => {
          toast({ title: 'Parada actualizada' });
          setOpen(false);
        },
        onError: (err) => {
          toast({ title: 'Error al guardar', description: err.message, variant: 'destructive' });
        },
      }
    );
  };

  const coordsValid = lat !== null && lng !== null && isValidPeruCoords(lat, lng);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={disabled}>
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Editar Parada #{stop.seq}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Address */}
          <div>
            <Label>Dirección completa</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: Centro Comercial Puruchuco, Ate, Lima"
            />
            <p className="text-xs text-muted-foreground mt-1">
              💡 Agrega distrito y ciudad para mejor precisión
            </p>
          </div>

          <Button onClick={handleReGeocode} variant="outline" disabled={geocoding || !address.trim()} className="w-full">
            {geocoding ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Geocodificando...</>
            ) : (
              <><MapPin className="w-4 h-4 mr-2" />Re-geocodificar</>
            )}
          </Button>

          <Separator />
          <p className="text-sm font-medium">O ingresa coordenadas manualmente:</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Latitud</Label>
              <Input
                type="number"
                step="0.000001"
                value={lat ?? ''}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setLat(isNaN(v) ? null : v);
                }}
                placeholder="-12.0851"
              />
            </div>
            <div>
              <Label>Longitud</Label>
              <Input
                type="number"
                step="0.000001"
                value={lng ?? ''}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setLng(isNaN(v) ? null : v);
                }}
                placeholder="-76.9232"
              />
            </div>
          </div>

          {/* Map preview */}
          {lat !== null && lng !== null && (
            <div className="border rounded overflow-hidden">
              <div ref={mapContainer} className="h-48" />
              <p className="text-xs text-center py-2 bg-muted">Vista previa de ubicación</p>
            </div>
          )}

          {/* Validation */}
          {lat !== null && lng !== null && (
            <Alert variant={isValidPeruCoords(lat, lng) ? 'default' : 'destructive'}>
              {isValidPeruCoords(lat, lng) ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <AlertDescription>✅ Coordenadas válidas para Perú</AlertDescription>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>⚠️ Coordenadas fuera de Perú. Verifica lat/lng.</AlertDescription>
                </>
              )}
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!coordsValid || updateStop.isPending}>
            {updateStop.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

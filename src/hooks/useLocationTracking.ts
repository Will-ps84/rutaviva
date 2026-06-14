import { useCallback, useRef, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation, GeolocationPosition } from './useGeolocation';
import { toast } from '@/hooks/use-toast';

interface UseLocationTrackingOptions {
  driverId: string;
  companyId: string;
  routeId?: string | null;
  throttleMs?: number;
}

export function useLocationTracking({
  driverId,
  companyId,
  routeId,
  throttleMs = 5000,
}: UseLocationTrackingOptions) {
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [sendCount, setSendCount] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const routeIdRef = useRef(routeId);
  
  // Keep routeId ref updated
  routeIdRef.current = routeId;

  const sendLocation = useCallback(async (position: GeolocationPosition) => {
    try {
      const { error } = await supabase
        .from('location_points')
        .insert({
          driver_id: driverId,
          company_id: companyId,
          route_id: routeIdRef.current || null,
          lat: position.latitude,
          lng: position.longitude,
          accuracy_m: position.accuracy,
          speed_mps: position.speed || 0,
          heading: position.heading || 0,
          recorded_at: new Date(position.timestamp).toISOString(),
        });

      if (error) {
        setSendError(error.message);
        return false;
      }
      setSendError(null);
      return true;
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [driverId, companyId]);

  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    sendLocation(position);
  }, [sendLocation]);

  const toastShownRef = useRef<Record<number, boolean>>({});

  const handleError = useCallback((error: GeolocationPositionError) => {
    // Only show toast once per error code to avoid spam on retries
    if (toastShownRef.current[error.code]) return;
    toastShownRef.current[error.code] = true;
    // Reset after 30s so it can show again if still failing
    setTimeout(() => { toastShownRef.current[error.code] = false; }, 30000);

    let message = 'Error de GPS';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Permiso de ubicación denegado. Habilita el GPS en tu navegador.';
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'Ubicación no disponible. Verifica tu conexión GPS.';
        break;
      case error.TIMEOUT:
        message = 'Obteniendo señal GPS... puede tardar unos segundos.';
        break;
    }

    toast({
      title: 'Error de ubicación',
      description: message,
      variant: error.code === error.TIMEOUT ? 'default' : 'destructive',
    });
  }, []);

  const geolocation = useGeolocation({
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 10000,
    throttleMs,
    onPosition: handlePositionUpdate,
    onError: handleError,
  });

  return {
    ...geolocation,
    lastSentAt,
    sendCount,
    sendError,
  };
}

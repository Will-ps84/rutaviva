import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

export interface GeolocationState {
  position: GeolocationPosition | null;
  error: GeolocationPositionError | null;
  isTracking: boolean;
  permissionStatus: PermissionState | null;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  throttleMs?: number;
  onPosition?: (position: GeolocationPosition) => void;
  onError?: (error: GeolocationPositionError) => void;
}

const isNative = Capacitor.isNativePlatform();

function makeGeoError(code: number, message: string): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    throttleMs = 5000,
    onPosition,
    onError,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    position: null,
    error: null,
    isTracking: false,
    permissionStatus: null,
  });

  // Native watch returns a string id; web watch returns a number
  const watchIdRef = useRef<string | number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const onPositionRef = useRef(onPosition);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onPositionRef.current = onPosition;
    onErrorRef.current = onError;
  }, [onPosition, onError]);

  const checkPermission = useCallback(async () => {
    if (isNative) {
      try {
        const status = await Geolocation.checkPermissions();
        const mapped = status.location === 'granted' ? 'granted'
          : status.location === 'denied' ? 'denied'
          : 'prompt';
        setState(prev => ({ ...prev, permissionStatus: mapped as PermissionState }));
        return mapped as PermissionState;
      } catch {
        return null;
      }
    }

    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setState(prev => ({ ...prev, permissionStatus: result.state }));
        result.addEventListener('change', () => {
          setState(prev => ({ ...prev, permissionStatus: result.state }));
        });
        return result.state;
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isNative) {
      try {
        const status = await Geolocation.requestPermissions();
        const granted = status.location === 'granted';
        setState(prev => ({
          ...prev,
          permissionStatus: granted ? 'granted' : 'denied',
        }));
        return granted;
      } catch {
        return false;
      }
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setState(prev => ({ ...prev, permissionStatus: 'granted' }));
          resolve(true);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setState(prev => ({ ...prev, permissionStatus: 'denied' }));
          }
          resolve(false);
        },
        { enableHighAccuracy, timeout, maximumAge }
      );
    });
  }, [enableHighAccuracy, timeout, maximumAge]);

  const startTracking = useCallback(() => {
    // Clear any existing watch
    if (watchIdRef.current !== null) {
      if (isNative) {
        Geolocation.clearWatch({ id: watchIdRef.current as string });
      } else {
        navigator.geolocation.clearWatch(watchIdRef.current as number);
      }
      watchIdRef.current = null;
    }

    setState(prev => ({ ...prev, isTracking: true, error: null }));

    const handlePosition = (pos: { coords: { latitude: number; longitude: number; accuracy: number; speed: number | null; heading: number | null }; timestamp: number }) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < throttleMs) return;
      lastUpdateRef.current = now;

      const position: GeolocationPosition = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        timestamp: pos.timestamp,
      };

      setState(prev => ({ ...prev, position, error: null }));
      onPositionRef.current?.(position);
    };

    if (isNative) {
      // Plugin nativo de Capacitor — mantiene un Android Foreground Service
      // que sigue enviando GPS aunque la app esté minimizada
      Geolocation.watchPosition(
        { enableHighAccuracy, timeout, maximumAge },
        (pos, err) => {
          if (err) {
            const geoError = makeGeoError(
              err.message?.includes('denied') ? 1 : 2,
              err.message ?? 'Error de ubicación'
            );
            setState(prev => ({ ...prev, error: geoError }));
            onErrorRef.current?.(geoError);
            return;
          }
          if (pos) handlePosition(pos);
        }
      ).then((id) => {
        watchIdRef.current = id;
      });
    } else {
      if (!navigator.geolocation) {
        const error = makeGeoError(0, 'Geolocation is not supported by this browser');
        setState(prev => ({ ...prev, error }));
        onErrorRef.current?.(error);
        return;
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        (error) => {
          setState(prev => ({ ...prev, error }));
          onErrorRef.current?.(error);
        },
        { enableHighAccuracy, timeout, maximumAge }
      );
    }
  }, [enableHighAccuracy, timeout, maximumAge, throttleMs]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      if (isNative) {
        Geolocation.clearWatch({ id: watchIdRef.current as string });
      } else {
        navigator.geolocation.clearWatch(watchIdRef.current as number);
      }
      watchIdRef.current = null;
    }
    setState(prev => ({ ...prev, isTracking: false }));
  }, []);

  useEffect(() => {
    checkPermission();

    return () => {
      if (watchIdRef.current !== null) {
        if (isNative) {
          Geolocation.clearWatch({ id: watchIdRef.current as string });
        } else {
          navigator.geolocation.clearWatch(watchIdRef.current as number);
        }
      }
    };
  }, [checkPermission]);

  return {
    ...state,
    startTracking,
    stopTracking,
    requestPermission,
    checkPermission,
  };
}

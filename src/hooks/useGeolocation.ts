import { useState, useCallback, useRef, useEffect } from 'react';

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

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    throttleMs = 5000, // Throttle to every 5 seconds by default
    onPosition,
    onError,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    position: null,
    error: null,
    isTracking: false,
    permissionStatus: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const onPositionRef = useRef(onPosition);
  const onErrorRef = useRef(onError);

  // Keep refs updated
  useEffect(() => {
    onPositionRef.current = onPosition;
    onErrorRef.current = onError;
  }, [onPosition, onError]);

  // Check permission status
  const checkPermission = useCallback(async () => {
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setState(prev => ({ ...prev, permissionStatus: result.state }));
        
        result.addEventListener('change', () => {
          setState(prev => ({ ...prev, permissionStatus: result.state }));
        });
        
        return result.state;
      } catch (e) {
        console.warn('Permission API not supported:', e);
        return null;
      }
    }
    return null;
  }, []);

  // Request permission (triggers browser prompt)
  const requestPermission = useCallback(async (): Promise<boolean> => {
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

  // Start tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      const error = {
        code: 0,
        message: 'Geolocation is not supported by this browser',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError;
      
      setState(prev => ({ ...prev, error }));
      onErrorRef.current?.(error);
      return;
    }

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setState(prev => ({ ...prev, isTracking: true, error: null }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (geoPosition) => {
        const now = Date.now();
        
        // Throttle updates
        if (now - lastUpdateRef.current < throttleMs) {
          return;
        }
        lastUpdateRef.current = now;

        const position: GeolocationPosition = {
          latitude: geoPosition.coords.latitude,
          longitude: geoPosition.coords.longitude,
          accuracy: geoPosition.coords.accuracy,
          speed: geoPosition.coords.speed,
          heading: geoPosition.coords.heading,
          timestamp: geoPosition.timestamp,
        };

        setState(prev => ({ ...prev, position, error: null }));
        onPositionRef.current?.(position);
      },
      (error) => {
        setState(prev => ({ ...prev, error }));
        onErrorRef.current?.(error);
      },
      { enableHighAccuracy, timeout, maximumAge }
    );
  }, [enableHighAccuracy, timeout, maximumAge, throttleMs]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState(prev => ({ ...prev, isTracking: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    checkPermission();
    
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
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

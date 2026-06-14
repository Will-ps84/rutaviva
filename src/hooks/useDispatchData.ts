import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserCompany } from './useCompany';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ============= TYPES =============

export interface DriverLocation {
  driver_id: string;
  driver_name: string | null;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading: number | null;
  recorded_at: string;
  route_id: string | null;
}

export type DriverStatus = 'active' | 'stopped' | 'noSignal';

export interface DriverStats {
  active: number;      // last_point < 60s
  stopped: number;     // last_point 60s - 5min
  noSignal: number;    // last_point > 5min
  total: number;
}

export interface ActiveRoute {
  id: string;
  name: string;
  status: 'in_progress' | 'published';
  driver_id: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  vehicle_plate: string | null;
  vehicle_label: string | null;
  total_stops: number;
  completed_stops: number;
  progress_percent: number;
  last_location?: DriverLocation;
  stops?: { lat: number; lng: number; label: string; status: string }[];
}

export interface DispatchFilters {
  routeId: string | null;
  driverId: string | null;
  status: DriverStatus | null;
  showAllFleet: boolean;
}

// ============= DRIVER LOCATIONS HOOK =============

export function useDriverLocations() {
  const { data: company } = useUserCompany();
  const [locations, setLocations] = useState<Map<string, DriverLocation>>(new Map());
  const [stats, setStats] = useState<DriverStats>({ active: 0, stopped: 0, noSignal: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const calculateStats = useCallback((locs: Map<string, DriverLocation>) => {
    const now = Date.now();
    let active = 0;
    let stopped = 0;
    let noSignal = 0;

    locs.forEach((loc) => {
      const age = now - new Date(loc.recorded_at).getTime();
      const ageSeconds = age / 1000;

      if (ageSeconds < 60) {
        active++;
      } else if (ageSeconds < 300) {
        stopped++;
      } else {
        noSignal++;
      }
    });

    setStats({ active, stopped, noSignal, total: locs.size });
  }, []);

  const fetchLocations = useCallback(async () => {
    if (!company?.id) return;

    setIsLoading(true);
    
    // Only fetch recent points (last 10 min) to avoid pulling thousands of rows
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('location_points')
      .select(`
        driver_id,
        lat,
        lng,
        accuracy_m,
        speed_mps,
        heading,
        recorded_at,
        route_id
      `)
      .eq('company_id', company.id)
      .gte('recorded_at', tenMinAgo)
      .order('recorded_at', { ascending: false });

    if (error) {
      setIsLoading(false);
      return;
    }

    const latestByDriver = new Map<string, DriverLocation>();
    
    if (data) {
      for (const point of data) {
        if (!latestByDriver.has(point.driver_id)) {
          latestByDriver.set(point.driver_id, {
            driver_id: point.driver_id,
            driver_name: null,
            lat: Number(point.lat),
            lng: Number(point.lng),
            accuracy_m: point.accuracy_m ? Number(point.accuracy_m) : null,
            speed_mps: point.speed_mps ? Number(point.speed_mps) : null,
            heading: point.heading ? Number(point.heading) : null,
            recorded_at: point.recorded_at,
            route_id: point.route_id,
          });
        }
      }
    }

    if (latestByDriver.size > 0) {
      const driverIds = Array.from(latestByDriver.keys());
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', driverIds);

      if (profiles) {
        for (const profile of profiles) {
          const loc = latestByDriver.get(profile.id);
          if (loc) {
            loc.driver_name = profile.full_name;
          }
        }
      }
    }

    setLocations(latestByDriver);
    calculateStats(latestByDriver);
    setIsLoading(false);
  }, [company?.id, calculateStats]);

  useEffect(() => {
    if (!company?.id) return;

    fetchLocations();

    const channel = supabase
      .channel('driver-locations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_points',
          filter: `company_id=eq.${company.id}`,
        },
        async (payload) => {
          const newPoint = payload.new as any;
          
          let driverName: string | null = null;
          
          setLocations((prev) => {
            const existingLoc = prev.get(newPoint.driver_id);
            if (existingLoc?.driver_name) {
              driverName = existingLoc.driver_name;
            }
            return prev;
          });
          
          if (!driverName) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', newPoint.driver_id)
              .single();
            driverName = profile?.full_name || null;
          }

          const updatedLocation: DriverLocation = {
            driver_id: newPoint.driver_id,
            driver_name: driverName,
            lat: Number(newPoint.lat),
            lng: Number(newPoint.lng),
            accuracy_m: newPoint.accuracy_m ? Number(newPoint.accuracy_m) : null,
            speed_mps: newPoint.speed_mps ? Number(newPoint.speed_mps) : null,
            heading: newPoint.heading ? Number(newPoint.heading) : null,
            recorded_at: newPoint.recorded_at,
            route_id: newPoint.route_id,
          };

          setLocations((prev) => {
            const updated = new Map(prev);
            updated.set(newPoint.driver_id, updatedLocation);
            calculateStats(updated);
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, fetchLocations, calculateStats]);

  useEffect(() => {
    const interval = setInterval(() => {
      calculateStats(locations);
    }, 10000);

    return () => clearInterval(interval);
  }, [locations, calculateStats]);

  return {
    locations: Array.from(locations.values()),
    locationsMap: locations,
    stats,
    isLoading,
    refetch: fetchLocations,
  };
}

// ============= ACTIVE ROUTES HOOK =============

export function useActiveRoutes() {
  const { data: company } = useUserCompany();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['active-routes', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];

      const { data, error } = await supabase
        .from('routes')
        .select(`
          id,
          name,
          status,
          driver_id,
          vehicle_id,
          driver:profiles!routes_driver_id_fkey(id, full_name),
          vehicle:vehicles(id, plate, label),
          route_stops(id, status, lat, lng, address_text, seq)
        `)
        .eq('company_id', company.id)
        .in('status', ['in_progress', 'published'])
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((route: any) => {
        const stops = route.route_stops || [];
        const completedStops = stops.filter((s: any) => s.status === 'done').length;
        const totalStops = stops.length;

        return {
          id: route.id,
          name: route.name,
          status: route.status,
          driver_id: route.driver_id,
          driver_name: route.driver?.full_name || null,
          vehicle_id: route.vehicle_id,
          vehicle_plate: route.vehicle?.plate || null,
          vehicle_label: route.vehicle?.label || null,
          total_stops: totalStops,
          completed_stops: completedStops,
          progress_percent: totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0,
          stops: stops.filter((s: any) => s.lat && s.lng).map((s: any) => ({
            lat: Number(s.lat), lng: Number(s.lng), label: s.address_text || '', status: s.status || 'pending',
          })),
        } as ActiveRoute;
      });
    },
    enabled: !!company?.id,
    refetchInterval: 30000,
  });

  // Subscribe to route_stops changes for realtime progress
  useEffect(() => {
    if (!company?.id) return;

    const channel = supabase
      .channel('route-stops-progress')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'route_stops',
        },
        () => {
          // Invalidate to refetch with new progress
          queryClient.invalidateQueries({ queryKey: ['active-routes', company.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, queryClient]);

  return query;
}

// ============= DISPATCH KPIs HOOK =============

export function useDispatchKPIs(
  driverStats: DriverStats,
  activeRoutes: ActiveRoute[]
) {
  return useMemo(() => {
    const routesInProgress = activeRoutes.filter(r => r.status === 'in_progress').length;
    
    const routesWithStops = activeRoutes.filter(r => r.total_stops > 0);
    const avgProgress = routesWithStops.length > 0
      ? Math.round(
          routesWithStops.reduce((sum, r) => sum + r.progress_percent, 0) / routesWithStops.length
        )
      : 0;

    return {
      activeDrivers: driverStats.active,
      routesInProgress,
      avgProgress,
    };
  }, [driverStats, activeRoutes]);
}

// ============= DRIVERS LIST FOR FILTERS =============

export function useCompanyDrivers() {
  const { data: company } = useUserCompany();

  return useQuery({
    queryKey: ['company-drivers', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];

      // Get driver role users first
      const { data: driverRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('company_id', company.id)
        .eq('role', 'driver');

      if (rolesError) throw rolesError;

      if (!driverRoles || driverRoles.length === 0) return [];

      const driverIds = driverRoles.map(r => r.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', driverIds);

      if (profilesError) throw profilesError;

      return profiles || [];
    },
    enabled: !!company?.id,
  });
}

// ============= FILTER LOGIC =============

export function useFilteredData(
  locations: DriverLocation[],
  activeRoutes: ActiveRoute[],
  filters: DispatchFilters
) {
  return useMemo(() => {
    let filteredLocations = [...locations];
    let filteredRoutes = [...activeRoutes];
    
    // Build a driver→location map from ALL locations (before route filter)
    // This ensures last_location lookup works even when route_id is null
    const allLocationsMap = new Map(locations.map(l => [l.driver_id, l]));

    // Filter by route - keep locations with matching route_id OR null route_id (with warning flag)
    if (filters.routeId) {
      filteredLocations = filteredLocations.filter(
        l => l.route_id === filters.routeId || l.route_id === null
      );
      filteredRoutes = filteredRoutes.filter(r => r.id === filters.routeId);
    }

    // Filter by driver
    if (filters.driverId) {
      filteredLocations = filteredLocations.filter(l => l.driver_id === filters.driverId);
      filteredRoutes = filteredRoutes.filter(r => r.driver_id === filters.driverId);
    }

    // Filter by status
    if (filters.status) {
      const now = Date.now();
      filteredLocations = filteredLocations.filter(loc => {
        const age = (now - new Date(loc.recorded_at).getTime()) / 1000;
        switch (filters.status) {
          case 'active':
            return age < 60;
          case 'stopped':
            return age >= 60 && age < 300;
          case 'noSignal':
            return age >= 300;
          default:
            return true;
        }
      });
    }

    // If not showing all fleet, only show drivers with active routes
    if (!filters.showAllFleet) {
      const activeRouteDriverIds = new Set(
        filteredRoutes.filter(r => r.driver_id).map(r => r.driver_id)
      );
      filteredLocations = filteredLocations.filter(l => activeRouteDriverIds.has(l.driver_id));
    }

    // Enrich routes with last location - use allLocationsMap (by driver_id, not route_id)
    filteredRoutes = filteredRoutes.map(route => ({
      ...route,
      last_location: route.driver_id ? allLocationsMap.get(route.driver_id) : undefined,
    }));

    // Check for null route_id locations
    const hasNullRouteLocations = filteredLocations.some(l => l.route_id === null);

    return {
      locations: filteredLocations,
      routes: filteredRoutes,
      hasNullRouteLocations,
    };
  }, [locations, activeRoutes, filters]);
}

// ============= GET DRIVER STATUS =============

export function getDriverStatus(recordedAt: string): DriverStatus {
  const age = (Date.now() - new Date(recordedAt).getTime()) / 1000;
  if (age < 60) return 'active';
  if (age < 300) return 'stopped';
  return 'noSignal';
}

export function formatTimeSince(recordedAt: string): string {
  const age = (Date.now() - new Date(recordedAt).getTime()) / 1000;
  if (age < 60) return `${Math.round(age)}s`;
  if (age < 3600) return `${Math.round(age / 60)}m`;
  return `${Math.round(age / 3600)}h`;
}

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserCompany } from './useCompany';

interface DriverLocation {
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

interface DriverStats {
  active: number;      // last_point < 60s
  stopped: number;     // last_point 60s - 5min
  noSignal: number;    // last_point > 5min
  total: number;
}

export function useDriverLocations() {
  const { data: company } = useUserCompany();
  const [locations, setLocations] = useState<Map<string, DriverLocation>>(new Map());
  const [stats, setStats] = useState<DriverStats>({ active: 0, stopped: 0, noSignal: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Calculate stats based on current locations
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
      } else if (ageSeconds < 300) { // 5 minutes
        stopped++;
      } else {
        noSignal++;
      }
    });

    setStats({ active, stopped, noSignal, total: locs.size });
  }, []);

  // Fetch initial locations - latest per driver
  const fetchLocations = useCallback(async () => {
    if (!company?.id) return;

    setIsLoading(true);
    
    // Get latest location per driver using a subquery
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
      .order('recorded_at', { ascending: false });

    if (error) {
      console.error('Error fetching locations:', error);
      setIsLoading(false);
      return;
    }

    // Get unique latest location per driver
    const latestByDriver = new Map<string, DriverLocation>();
    
    if (data) {
      for (const point of data) {
        if (!latestByDriver.has(point.driver_id)) {
          latestByDriver.set(point.driver_id, {
            driver_id: point.driver_id,
            driver_name: null, // Will be enriched below
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

    // Enrich with driver names
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

  // Subscribe to realtime updates
  useEffect(() => {
    if (!company?.id) return;

    fetchLocations();

    // Subscribe to new location inserts
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
          
          // Get driver name if not cached
          let driverName: string | null = null;
          const existingLoc = locations.get(newPoint.driver_id);
          
          if (existingLoc?.driver_name) {
            driverName = existingLoc.driver_name;
          } else {
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

  // Recalculate stats every 10 seconds (for age-based changes)
  useEffect(() => {
    const interval = setInterval(() => {
      calculateStats(locations);
    }, 10000);

    return () => clearInterval(interval);
  }, [locations, calculateStats]);

  return {
    locations: Array.from(locations.values()),
    stats,
    isLoading,
    refetch: fetchLocations,
  };
}

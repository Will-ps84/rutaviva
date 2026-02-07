import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { format } from 'date-fns';

export interface DriverRoute {
  id: string;
  name: string;
  date: string;
  status: 'draft' | 'published' | 'in_progress' | 'done';
  vehicle_id: string | null;
  stops: Array<{
    id: string;
    seq: number;
    address_text: string;
    status: 'pending' | 'arrived' | 'done' | 'skipped';
    lat: number | null;
    lng: number | null;
    notes: string | null;
  }>;
}

export interface DriverProfile {
  id: string;
  full_name: string | null;
  company_id: string | null;
  phone: string | null;
}

export function useDriverProfile() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['driver-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, company_id, phone')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data as DriverProfile;
    },
    enabled: !!user?.id,
  });
}

export function useDriverTodayRoute() {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['driver-today-route', user?.id, today],
    queryFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Get routes assigned to this driver for today (including done for reactivation)
      const { data: routes, error: routesError } = await supabase
        .from('routes')
        .select(`
          id,
          name,
          date,
          status,
          vehicle_id
        `)
        .eq('driver_id', user.id)
        .eq('date', today)
        .in('status', ['published', 'in_progress', 'done'])
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (routesError) throw routesError;
      
      if (!routes || routes.length === 0) {
        return null;
      }
      
      const route = routes[0];
      
      // Get stops for this route
      const { data: stops, error: stopsError } = await supabase
        .from('route_stops')
        .select('id, seq, address_text, status, lat, lng, notes')
        .eq('route_id', route.id)
        .order('seq', { ascending: true });
      
      if (stopsError) throw stopsError;
      
      return {
        ...route,
        stops: stops || [],
      } as DriverRoute;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds to get updates
  });
}

export function useUpdateRouteStatus() {
  const { user } = useAuth();
  
  const updateStatus = async (routeId: string, status: 'in_progress' | 'done') => {
    // Only set completed_at when finishing, clear it when reactivating
    if (status === 'done') {
      const { error } = await supabase
        .from('routes')
        .update({
          status: 'done' as const,
          completed_at: new Date().toISOString(),
        })
        .eq('id', routeId)
        .eq('driver_id', user?.id);
      
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('routes')
        .update({
          status: 'in_progress' as const,
          completed_at: null,
        })
        .eq('id', routeId)
        .eq('driver_id', user?.id);
      
      if (error) throw error;
    }
  };
  
  const reactivateRoute = async (routeId: string) => {
    const { error } = await supabase
      .from('routes')
      .update({
        status: 'in_progress' as const,
        completed_at: null,
      })
      .eq('id', routeId)
      .eq('driver_id', user?.id);
    
    if (error) throw error;
  };
  
  return { updateStatus, reactivateRoute };
}

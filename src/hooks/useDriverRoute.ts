import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface DriverStop {
  id: string;
  seq: number;
  address_text: string;
  status: 'pending' | 'arrived' | 'done' | 'skipped' | 'failed';
  lat: number | null;
  lng: number | null;
  notes: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  evidence_url: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  tracking_token: string | null;
}

export interface DriverRoute {
  id: string;
  name: string;
  date: string;
  status: 'draft' | 'published' | 'in_progress' | 'done';
  vehicle_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  stops: DriverStop[];
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

  return useQuery({
    queryKey: ['driver-active-route', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: routes, error: routesError } = await supabase
        .from('routes')
        .select('id, name, date, status, vehicle_id, started_at, completed_at')
        .eq('driver_id', user.id)
        .in('status', ['published', 'in_progress', 'done'])
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (routesError) throw routesError;
      if (!routes || routes.length === 0) return null;

      const route = routes[0];

      const { data: stops, error: stopsError } = await supabase
        .from('route_stops')
        .select('id, seq, address_text, status, lat, lng, notes, completed_at, failure_reason, evidence_url, recipient_name, recipient_phone, tracking_token')
        .eq('route_id', route.id)
        .order('seq', { ascending: true });

      if (stopsError) throw stopsError;

      return {
        ...route,
        stops: (stops || []) as DriverStop[],
      } as DriverRoute;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
}

export function useUpdateRouteStatus() {
  const { user } = useAuth();

  const updateStatus = async (routeId: string, status: 'in_progress' | 'done') => {
    const updateData: Record<string, unknown> = { status };
    if (status === 'done') {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
      updateData.started_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from('routes')
      .update(updateData)
      .eq('id', routeId)
      .eq('driver_id', user?.id);
    if (error) throw error;
  };

  const reactivateRoute = async (routeId: string) => {
    const { error } = await supabase
      .from('routes')
      .update({ status: 'in_progress', completed_at: null })
      .eq('id', routeId)
      .eq('driver_id', user?.id);
    if (error) throw error;
  };

  return { updateStatus, reactivateRoute };
}

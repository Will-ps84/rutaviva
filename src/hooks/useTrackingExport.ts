import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserCompany } from './useCompany';

export interface TrackingExportFilters {
  dateFrom: string;
  dateTo: string;
  driverId?: string;
}

export function useTrackingData(filters: TrackingExportFilters, enabled: boolean) {
  const { user } = useAuth();
  const { data: company } = useUserCompany();

  return useQuery({
    queryKey: ['tracking-export', filters, company?.id],
    queryFn: async () => {
      if (!company?.id) throw new Error('No company');

      let query = supabase
        .from('location_points')
        .select('recorded_at, driver_id, lat, lng, speed_mps, heading, accuracy_m, route_id, company_id')
        .eq('company_id', company.id)
        .gte('recorded_at', `${filters.dateFrom}T00:00:00`)
        .lte('recorded_at', `${filters.dateTo}T23:59:59`)
        .order('recorded_at', { ascending: true });

      if (filters.driverId && filters.driverId !== 'all') {
        query = query.eq('driver_id', filters.driverId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!user && !!company?.id,
  });
}

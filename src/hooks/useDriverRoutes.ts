import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface DriverRouteListItem {
  id: string;
  name: string;
  date: string;
  status: 'draft' | 'published' | 'in_progress' | 'done';
  totalStops: number;
  doneStops: number;
}

export function useDriverRoutes(filter: 'today' | 'week' | 'all' = 'all') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['driver-routes', user?.id, filter],
    queryFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      let query = supabase
        .from('routes')
        .select('id, name, date, status, route_stops(id, status)')
        .eq('driver_id', user.id)
        .in('status', ['published', 'in_progress', 'done'])
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filter === 'today') {
        // "Hoy" shows active/pending routes regardless of date, plus today's done routes
        const today = new Date().toISOString().split('T')[0];
        query = query.or(
          `status.in.(published,in_progress),and(status.in.(done,draft),date.eq.${today})`
        );
      } else if (filter === 'week') {
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('date', weekAgo.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((r: any): DriverRouteListItem => {
        const stops = r.route_stops || [];
        return {
          id: r.id,
          name: r.name,
          date: r.date,
          status: r.status,
          totalStops: stops.length,
          doneStops: stops.filter((s: any) => s.status === 'done').length,
        };
      });
    },
    enabled: !!user?.id,
  });
}

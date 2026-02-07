import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface Route {
  id: string;
  company_id: string;
  name: string;
  date: string;
  status: 'draft' | 'published' | 'in_progress' | 'done';
  driver_id: string | null;
  vehicle_id: string | null;
  polyline: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  driver?: { id: string; full_name: string | null } | null;
  vehicle?: { id: string; plate: string; label: string | null } | null;
  route_stops?: RouteStop[];
}

export interface RouteStop {
  id: string;
  route_id: string;
  seq: number;
  address_text: string;
  lat: number | null;
  lng: number | null;
  planned_window_start: string | null;
  planned_window_end: string | null;
  status: 'pending' | 'arrived' | 'done' | 'skipped';
  notes: string | null;
  created_at: string;
}

export function useRoutes() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select(`
          *,
          driver:profiles!routes_driver_id_fkey(id, full_name),
          vehicle:vehicles(id, plate, label),
          route_stops(count)
        `)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as (Route & { route_stops: { count: number }[] })[];
    },
    enabled: !!user,
  });
}

export function useRoute(routeId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['route', routeId],
    queryFn: async () => {
      if (!routeId) throw new Error('Route ID required');
      
      const { data, error } = await supabase
        .from('routes')
        .select(`
          *,
          driver:profiles!routes_driver_id_fkey(id, full_name),
          vehicle:vehicles(id, plate, label),
          route_stops(*)
        `)
        .eq('id', routeId)
        .single();
      
      if (error) throw error;
      
      // Sort stops by sequence
      if (data.route_stops) {
        data.route_stops.sort((a: RouteStop, b: RouteStop) => a.seq - b.seq);
      }
      
      return data as Route;
    },
    enabled: !!user && !!routeId,
  });
}

export function useCreateRoute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; date: string; company_id: string }) => {
      const { data: route, error } = await supabase
        .from('routes')
        .insert({
          name: data.name,
          date: data.date,
          company_id: data.company_id,
          status: 'draft',
        })
        .select()
        .single();
      
      if (error) throw error;
      return route;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (error) => {
      toast({
        title: 'Error al crear ruta',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useCreateRouteStops() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (stops: Omit<RouteStop, 'id' | 'created_at'>[]) => {
      const { data, error } = await supabase
        .from('route_stops')
        .insert(stops)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['route', variables[0].route_id] });
        queryClient.invalidateQueries({ queryKey: ['routes'] });
      }
    },
  });
}

export function useUpdateRoute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Route> & { id: string }) => {
      const { data, error } = await supabase
        .from('routes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['route', data.id] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({
        title: 'Ruta actualizada',
        description: 'Los cambios se guardaron correctamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al actualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateRouteStop() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, route_id, ...updates }: Partial<RouteStop> & { id: string; route_id: string }) => {
      const { data, error } = await supabase
        .from('route_stops')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, route_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['route', data.route_id] });
    },
  });
}

export function useDeleteRoute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (routeId: string) => {
      const { error } = await supabase
        .from('routes')
        .delete()
        .eq('id', routeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({
        title: 'Ruta eliminada',
        description: 'La ruta fue eliminada correctamente.',
      });
    },
  });
}

export function useReactivateRoute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (routeId: string) => {
      const { data, error } = await supabase
        .from('routes')
        .update({
          status: 'in_progress',
          completed_at: null,
        })
        .eq('id', routeId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['route', data.id] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast({
        title: 'Ruta reactivada',
        description: 'La ruta ahora está en progreso nuevamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al reactivar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useUpdateStopStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      stopId, 
      status 
    }: { 
      stopId: string; 
      status: 'pending' | 'arrived' | 'done' | 'skipped' | 'failed';
    }) => {
      const { data, error } = await supabase
        .from('route_stops')
        .update({ status })
        .eq('id', stopId)
        .select('id, route_id, status')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['route', data.route_id] });
      queryClient.invalidateQueries({ queryKey: ['driver-today-route'] });
      queryClient.invalidateQueries({ queryKey: ['active-routes'] });
      
      if (data.status === 'done') {
        toast({
          title: 'Parada completada',
          description: 'El progreso de la ruta se actualizó.',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

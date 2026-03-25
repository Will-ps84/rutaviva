import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UpdateStopStatusParams {
  stopId: string;
  status: 'pending' | 'arrived' | 'done' | 'skipped' | 'failed';
  failure_reason?: string;
  completed_at?: string;
}

export function useUpdateStopStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stopId, status, failure_reason, completed_at }: UpdateStopStatusParams) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'done') {
        updates.completed_at = completed_at || new Date().toISOString();
      }
      if (failure_reason) {
        updates.failure_reason = failure_reason;
      }

      const { data, error } = await supabase
        .from('route_stops')
        .update(updates)
        .eq('id', stopId)
        .select('id, route_id, status')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['route', data.route_id] });
      queryClient.invalidateQueries({ queryKey: ['driver-active-route'] });
      queryClient.invalidateQueries({ queryKey: ['active-routes'] });

      if (data.status === 'done') {
        toast({ title: '✅ Parada completada', description: 'El progreso de la ruta se actualizó.' });
      }
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

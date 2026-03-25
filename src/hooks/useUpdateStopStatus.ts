import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useCreateAlert } from '@/hooks/useRouteAlerts';
import { useAuth } from '@/hooks/useAuth';

interface UpdateStopStatusParams {
  stopId: string;
  status: 'pending' | 'arrived' | 'done' | 'skipped' | 'failed';
  failure_reason?: string;
  completed_at?: string;
}

export function useUpdateStopStatus() {
  const queryClient = useQueryClient();
  const createAlert = useCreateAlert();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ stopId, status, failure_reason, completed_at }: UpdateStopStatusParams) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'done') {
        updates.completed_at = completed_at || new Date().toISOString();
      }
      if (status === 'failed' || status === 'skipped') {
        // Clear completed_at on failure/skip
        updates.completed_at = null;
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

      // Auto-advance route status
      if (data.route_id) {
        const finalStatuses = ['done', 'skipped', 'failed'];
        const isFinal = finalStatuses.includes(status);

        if (status === 'arrived' || status === 'done' || status === 'skipped' || status === 'failed') {
          // Ensure route is in_progress when first stop is touched
          const { data: routeData } = await supabase
            .from('routes')
            .select('status, company_id, driver_id')
            .eq('id', data.route_id)
            .single();

          if (routeData && routeData.status === 'published') {
            await supabase
              .from('routes')
              .update({ status: 'in_progress', started_at: new Date().toISOString() })
              .eq('id', data.route_id);
          }

          // Check if all stops are in a final state → mark route done
          if (isFinal && routeData) {
            const { data: allStops } = await supabase
              .from('route_stops')
              .select('status')
              .eq('route_id', data.route_id);

            const allFinal = allStops?.every(s => finalStatuses.includes(s.status));
            if (allFinal && routeData.status !== 'done') {
              await supabase
                .from('routes')
                .update({ status: 'done', completed_at: new Date().toISOString() })
                .eq('id', data.route_id);

              // Fire route_completed alert
              if (routeData.company_id) {
                createAlert.mutate({
                  company_id: routeData.company_id,
                  route_id: data.route_id,
                  driver_id: routeData.driver_id,
                  stop_id: null,
                  type: 'route_completed',
                  message: 'Ruta completada — todas las paradas fueron atendidas',
                });
              }
            }

            // Fire delivery_failed alert for failed stops
            if (status === 'failed' && routeData.company_id) {
              createAlert.mutate({
                company_id: routeData.company_id,
                route_id: data.route_id,
                driver_id: routeData.driver_id,
                stop_id: stopId,
                type: 'delivery_failed',
                message: `Entrega fallida${failure_reason ? `: ${failure_reason}` : ''}`,
              });
            }
          }
        }
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['route', data.route_id] });
      queryClient.invalidateQueries({ queryKey: ['driver-active-route'] });
      queryClient.invalidateQueries({ queryKey: ['active-routes'] });

      if (data.status === 'done') {
        toast({ title: '✅ Parada completada', description: 'El progreso de la ruta se actualizó.' });
      } else if (data.status === 'arrived') {
        toast({ title: '📍 Llegada confirmada', description: 'Puedes marcar la entrega cuando estés listo.' });
      }
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

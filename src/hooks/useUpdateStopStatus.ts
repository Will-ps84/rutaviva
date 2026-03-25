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
      // 1. Build stop update payload
      const updates: Record<string, unknown> = { status };
      if (status === 'done') {
        updates.completed_at = completed_at || new Date().toISOString();
      }
      if (status === 'failed' || status === 'skipped') {
        updates.completed_at = null;
      }
      if (failure_reason) {
        updates.failure_reason = failure_reason;
      }

      // 2. Update the stop
      const { data: stopData, error: stopError } = await supabase
        .from('route_stops')
        .update(updates)
        .eq('id', stopId)
        .select('id, route_id, status')
        .single();

      if (stopError) throw stopError;

      const routeId = stopData.route_id;
      if (!routeId) return stopData;

      // 3. Fetch current route data (status, company, driver, name)
      const { data: routeData } = await supabase
        .from('routes')
        .select('id, status, company_id, driver_id, name')
        .eq('id', routeId)
        .single();

      if (!routeData) return stopData;

      // 4. If route was 'published' and driver touched a stop → move to 'in_progress'
      if (
        routeData.status === 'published' &&
        (status === 'arrived' || status === 'done' || status === 'skipped' || status === 'failed')
      ) {
        await supabase
          .from('routes')
          .update({ status: 'in_progress', started_at: new Date().toISOString() })
          .eq('id', routeId);
      }

      // 5. Fire delivery_failed alert immediately when a stop fails
      if (status === 'failed' && routeData.company_id) {
        await supabase.from('route_alerts').insert({
          company_id: routeData.company_id,
          route_id: routeId,
          driver_id: routeData.driver_id,
          stop_id: stopId,
          type: 'delivery_failed',
          message: `❌ Entrega fallida${failure_reason ? `: ${failure_reason}` : ''}`,
          is_read: false,
        });
      }

      // 6. Check if ALL stops are now in a final state
      const finalStatuses = ['done', 'failed', 'skipped'];
      if (finalStatuses.includes(status)) {
        const { data: allStops } = await supabase
          .from('route_stops')
          .select('status')
          .eq('route_id', routeId);

        const allFinished =
          allStops &&
          allStops.length > 0 &&
          allStops.every(s => finalStatuses.includes(s.status));

        if (allFinished && routeData.status !== 'done') {
          // 7. Close the route
          await supabase
            .from('routes')
            .update({ status: 'done', completed_at: new Date().toISOString() })
            .eq('id', routeId);

          // 8. Fire route_completed alert with driver name and route name
          if (routeData.company_id) {
            // Fetch driver name for a richer alert message
            const { data: driverProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', routeData.driver_id ?? '')
              .maybeSingle();

            const driverName = driverProfile?.full_name || 'El conductor';
            const routeName = routeData.name || 'la ruta';

            await supabase.from('route_alerts').insert({
              company_id: routeData.company_id,
              route_id: routeId,
              driver_id: routeData.driver_id,
              stop_id: null,
              type: 'route_completed',
              message: `✅ ${driverName} completó la ruta "${routeName}"`,
              is_read: false,
            });
          }
        }
      }

      return stopData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['route', data.route_id] });
      queryClient.invalidateQueries({ queryKey: ['driver-active-route'] });
      queryClient.invalidateQueries({ queryKey: ['active-routes'] });
      queryClient.invalidateQueries({ queryKey: ['route-alerts'] });

      if (data.status === 'done') {
        toast({ title: '✅ Parada completada', description: 'El progreso de la ruta se actualizó.' });
      } else if (data.status === 'arrived') {
        toast({ title: '📍 Llegada confirmada', description: 'Puedes marcar la entrega cuando estés listo.' });
      }
    },
    onError: (error) => {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UpdateStopStatusParams {
  stopId: string;
  status: 'pending' | 'arrived' | 'done' | 'skipped' | 'failed';
  failure_reason?: string;
  completed_at?: string;
}

const FINAL_STATUSES = ['done', 'failed', 'skipped'];

async function triggerNotification(payload: {
  event: 'driver_en_camino' | 'entrega_completada' | 'entrega_fallida';
  recipientPhone: string;
  recipientName?: string | null;
  driverName?: string | null;
  stopAddress?: string | null;
  trackingToken?: string | null;
  failureReason?: string | null;
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.functions.invoke('send-notification', {
      body: {
        event: payload.event,
        recipientPhone: payload.recipientPhone,
        recipientName: payload.recipientName ?? undefined,
        driverName: payload.driverName ?? undefined,
        stopAddress: payload.stopAddress ?? undefined,
        trackingToken: payload.trackingToken ?? undefined,
        failureReason: payload.failureReason ?? undefined,
        channel: 'whatsapp',
      },
    });
  } catch {
    // Notificaciones son best-effort: no bloquear el flujo principal si fallan
  }
}

export function useUpdateStopStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stopId, status, failure_reason, completed_at }: UpdateStopStatusParams) => {
      // ── PASO 1: Actualizar la parada ──
      const updates: Record<string, unknown> = { status };
      if (FINAL_STATUSES.includes(status)) {
        updates.completed_at = completed_at || new Date().toISOString();
      } else if (status === 'arrived' || status === 'pending') {
        updates.completed_at = null;
      }
      if (failure_reason) updates.failure_reason = failure_reason;

      const { data: stopData, error: stopError } = await supabase
        .from('route_stops')
        .update(updates)
        .eq('id', stopId)
        .select('id, route_id, status, recipient_name, recipient_phone, address_text, tracking_token')
        .single();

      if (stopError) throw stopError;

      const routeId = stopData.route_id;
      if (!routeId) {
        console.error('useUpdateStopStatus: routeId is null/undefined after stop update');
        return stopData;
      }

      // ── PASO 2: Obtener estado actual de la ruta ──
      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .select('id, status, company_id, driver_id, name')
        .eq('id', routeId)
        .single();

      if (routeError || !routeData) {
        console.error('useUpdateStopStatus: could not fetch route', routeError);
        return stopData;
      }

      // Obtener nombre del conductor para las notificaciones
      let driverName: string | null = null;
      if (routeData.driver_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', routeData.driver_id)
          .single();
        driverName = profile?.full_name ?? null;
      }

      // Si la ruta estaba 'published' y el conductor tocó una parada → 'in_progress'
      if (
        routeData.status === 'published' &&
        ['arrived', 'done', 'skipped', 'failed'].includes(status)
      ) {
        await supabase
          .from('routes')
          .update({ status: 'in_progress', started_at: new Date().toISOString() })
          .eq('id', routeId);
      }

      // ── NOTIFICACIÓN: conductor en camino (arrived) ──
      if (status === 'arrived' && stopData.recipient_phone) {
        triggerNotification({
          event: 'driver_en_camino',
          recipientPhone: stopData.recipient_phone,
          recipientName: stopData.recipient_name,
          driverName,
          stopAddress: stopData.address_text,
          trackingToken: stopData.tracking_token,
        });
      }

      // ── NOTIFICACIÓN: entrega completada (done) ──
      if (status === 'done' && stopData.recipient_phone) {
        triggerNotification({
          event: 'entrega_completada',
          recipientPhone: stopData.recipient_phone,
          recipientName: stopData.recipient_name,
          stopAddress: stopData.address_text,
          trackingToken: stopData.tracking_token,
        });
      }

      // ── NOTIFICACIÓN: entrega fallida ──
      if (status === 'failed') {
        // Alerta interna al dispatcher
        if (routeData.company_id) {
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

        // Notificación WhatsApp al destinatario
        if (stopData.recipient_phone) {
          triggerNotification({
            event: 'entrega_fallida',
            recipientPhone: stopData.recipient_phone,
            recipientName: stopData.recipient_name,
            stopAddress: stopData.address_text,
            failureReason: failure_reason,
          });
        }
      }

      // ── PASO 3: Verificar si TODAS las paradas están finalizadas ──
      if (FINAL_STATUSES.includes(status)) {
        const { data: allStops } = await supabase
          .from('route_stops')
          .select('status')
          .eq('route_id', routeId);

        if (!allStops || allStops.length === 0) return stopData;

        const allFinished = allStops.every(s => FINAL_STATUSES.includes(s.status));

        // ── PASO 4: Cerrar la ruta si todas finalizaron ──
        if (allFinished) {
          const { error: closeError } = await supabase
            .from('routes')
            .update({ status: 'done', completed_at: new Date().toISOString() })
            .eq('id', routeId);

          if (closeError) {
            console.error('Auto-close error:', closeError);
          } else {
            if (routeData.company_id) {
              await supabase.from('route_alerts').insert({
                company_id: routeData.company_id,
                route_id: routeId,
                driver_id: routeData.driver_id,
                stop_id: null,
                type: 'route_completed',
                message: `✅ Ruta "${routeData.name || 'sin nombre'}" completada`,
                is_read: false,
              });
            }

            toast({ title: '🎉 Ruta completada', description: 'Todas las paradas fueron finalizadas.' });
          }
        }
      }

      return stopData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['route', data.route_id] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
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

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserCompany } from './useCompany';

export interface RouteAlert {
  id: string;
  company_id: string;
  route_id: string | null;
  driver_id: string | null;
  stop_id: string | null;
  type: 'long_stop' | 'no_signal' | 'route_completed' | 'delivery_failed';
  message: string;
  is_read: boolean;
  created_at: string;
}

export function useRouteAlerts() {
  const { data: company } = useUserCompany();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['route-alerts', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from('route_alerts')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as RouteAlert[];
    },
    enabled: !!company?.id,
  });

  // Realtime subscription for new alerts
  useEffect(() => {
    if (!company?.id) return;
    const channel = supabase
      .channel('route-alerts-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'route_alerts',
        filter: `company_id=eq.${company.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['route-alerts', company.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [company?.id, queryClient]);

  return query;
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();
  const { data: company } = useUserCompany();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('route_alerts')
        .update({ is_read: true })
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-alerts', company?.id] });
    },
  });
}

export function useMarkAllAlertsRead() {
  const queryClient = useQueryClient();
  const { data: company } = useUserCompany();

  return useMutation({
    mutationFn: async () => {
      if (!company?.id) return;
      const { error } = await supabase
        .from('route_alerts')
        .update({ is_read: true })
        .eq('company_id', company.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-alerts', company?.id] });
    },
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  const { data: company } = useUserCompany();

  return useMutation({
    mutationFn: async (alert: Omit<RouteAlert, 'id' | 'created_at' | 'is_read'>) => {
      const { data, error } = await supabase
        .from('route_alerts')
        .insert({ ...alert, is_read: false })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-alerts', company?.id] });
    },
  });
}

// Hook to detect no-signal and long-stop alerts
export function useAlertDetection(
  locations: Array<{ driver_id: string; driver_name: string | null; recorded_at: string; lat: number; lng: number; route_id: string | null }>,
  companyId: string | undefined,
  noSignalThresholdMin = 10,
  longStopThresholdMin = 20
) {
  const createAlert = useCreateAlert();
  const [firedAlerts, setFiredAlerts] = useState<Set<string>>(new Set());
  const [prevPositions, setPrevPositions] = useState<Map<string, { lat: number; lng: number; since: Date }>>(new Map());

  const checkAlerts = useCallback(() => {
    if (!companyId || locations.length === 0) return;
    const now = Date.now();

    locations.forEach((loc) => {
      const ageMin = (now - new Date(loc.recorded_at).getTime()) / 60000;

      // No signal alert
      const noSignalKey = `no_signal_${loc.driver_id}_${Math.floor(ageMin / noSignalThresholdMin)}`;
      if (ageMin > noSignalThresholdMin && !firedAlerts.has(noSignalKey)) {
        createAlert.mutate({
          company_id: companyId,
          route_id: loc.route_id,
          driver_id: loc.driver_id,
          stop_id: null,
          type: 'no_signal',
          message: `${loc.driver_name || 'Conductor'} lleva más de ${noSignalThresholdMin} min sin señal GPS`,
        });
        setFiredAlerts(prev => new Set([...prev, noSignalKey]));
      }

      // Long stop detection
      const prev = prevPositions.get(loc.driver_id);
      const distanceMoved = prev
        ? Math.sqrt(Math.pow((loc.lat - prev.lat) * 111000, 2) + Math.pow((loc.lng - prev.lng) * 111000, 2))
        : 999;

      if (distanceMoved < 50) {
        if (!prev) {
          setPrevPositions(p => new Map(p).set(loc.driver_id, { lat: loc.lat, lng: loc.lng, since: new Date() }));
        } else {
          const stoppedMin = (now - prev.since.getTime()) / 60000;
          const longStopKey = `long_stop_${loc.driver_id}_${Math.floor(stoppedMin / longStopThresholdMin)}`;
          if (stoppedMin > longStopThresholdMin && !firedAlerts.has(longStopKey)) {
            createAlert.mutate({
              company_id: companyId,
              route_id: loc.route_id,
              driver_id: loc.driver_id,
              stop_id: null,
              type: 'long_stop',
              message: `${loc.driver_name || 'Conductor'} lleva más de ${Math.round(stoppedMin)} min detenido en la misma ubicación`,
            });
            setFiredAlerts(prev => new Set([...prev, longStopKey]));
          }
        }
      } else {
        setPrevPositions(p => new Map(p).set(loc.driver_id, { lat: loc.lat, lng: loc.lng, since: new Date() }));
      }
    });
  }, [locations, companyId, firedAlerts, prevPositions, createAlert, noSignalThresholdMin, longStopThresholdMin]);

  useEffect(() => {
    const interval = setInterval(checkAlerts, 2 * 60 * 1000); // every 2 min
    return () => clearInterval(interval);
  }, [checkAlerts]);
}

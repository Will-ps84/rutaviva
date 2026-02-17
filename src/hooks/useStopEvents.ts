import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface StopEvent {
  id: string;
  company_id: string;
  route_id: string;
  stop_id: string;
  created_by: string;
  event_type: string;
  note: string | null;
  evidence_path: string | null;
  created_at: string;
}

export function useStopEvents(stopId: string | null) {
  return useQuery({
    queryKey: ['stop-events', stopId],
    queryFn: async () => {
      if (!stopId) return [];
      const { data, error } = await supabase
        .from('stop_events')
        .select('*')
        .eq('stop_id', stopId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as StopEvent[];
    },
    enabled: !!stopId,
  });
}

interface CreateStopEventParams {
  companyId: string;
  routeId: string;
  stopId: string;
  eventType: string;
  note?: string;
  evidenceFile?: File;
}

export function useCreateStopEvent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, routeId, stopId, eventType, note, evidenceFile }: CreateStopEventParams) => {
      if (!user) throw new Error('No autenticado');

      let evidencePath: string | null = null;

      // Upload evidence file if provided
      if (evidenceFile) {
        const ext = evidenceFile.name.split('.').pop() || 'jpg';
        const filePath = `${user.id}/${stopId}/${Date.now()}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('stop-evidence')
          .upload(filePath, evidenceFile, { cacheControl: '3600', upsert: false });

        if (uploadError) throw new Error(`Error subiendo evidencia: ${uploadError.message}`);
        evidencePath = filePath;
      }

      // Insert stop event
      const { data, error } = await supabase
        .from('stop_events')
        .insert({
          company_id: companyId,
          route_id: routeId,
          stop_id: stopId,
          created_by: user.id,
          event_type: eventType,
          note: note || null,
          evidence_path: evidencePath,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stop-events', data.stop_id] });
    },
    onError: (error) => {
      toast({
        title: 'Error al registrar evento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

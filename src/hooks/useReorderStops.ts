import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Actualiza el campo `seq` de cada stop para reflejar el nuevo orden.
 * Recibe un array de IDs en el orden deseado; el índice determina el seq.
 */
export function useReorderStops(routeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedStopIds: string[]) => {
      // Ejecutar updates en paralelo
      const updates = orderedStopIds.map((stopId, idx) =>
        supabase
          .from('route_stops')
          .update({ seq: idx + 1 })
          .eq('id', stopId)
      );

      const results = await Promise.all(updates);
      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw firstError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', routeId] });
      toast({ title: 'Orden guardado', description: 'Las paradas fueron reordenadas en la base de datos.' });
    },
    onError: (err) => {
      toast({ title: 'Error al guardar orden', description: (err as Error).message, variant: 'destructive' });
    },
  });
}

import { RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import type { Route, RouteStop } from '@/hooks/useRoutes';

interface ResumeFailedDialogProps {
  route: Route & { route_stops?: RouteStop[] };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const stopStatusLabels: Record<string, string> = {
  failed: 'Fallida',
  skipped: 'Omitida',
};

export function ResumeFailedDialog({ route, open, onOpenChange }: ResumeFailedDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const failedStops = (route.route_stops || []).filter(s => s.status === 'failed' || s.status === 'skipped');

  const handleResume = async () => {
    setLoading(true);
    try {
      // Reset failed/skipped stops to pending
      const stopIds = failedStops.map(s => s.id);
      if (stopIds.length > 0) {
        const { error: stopsErr } = await supabase
          .from('route_stops')
          .update({ status: 'pending', failure_reason: null })
          .in('id', stopIds);
        if (stopsErr) throw stopsErr;
      }

      // Reopen route
      const { error: routeErr } = await supabase
        .from('routes')
        .update({ status: 'published', completed_at: null })
        .eq('id', route.id);
      if (routeErr) throw routeErr;

      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['route', route.id] });
      toast({ title: 'Ruta reactivada', description: `${failedStops.length} entrega(s) pendientes de reintentar.` });
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Error desconocido', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Reanudar entregas fallidas
          </DialogTitle>
          <DialogDescription>
            Hay <strong>{failedStops.length}</strong> entrega(s) no completadas en esta ruta. ¿Reanudar la ruta?
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-56">
          <div className="space-y-1.5 pr-1">
            {failedStops.map(stop => (
              <div key={stop.id} className="flex items-center justify-between py-1.5 px-3 bg-muted/50 rounded-lg text-sm">
                <span className="font-medium text-muted-foreground">#{stop.seq}</span>
                <span className="flex-1 mx-3 truncate">{stop.address_text}</span>
                <Badge variant="outline" className={
                  stop.status === 'failed'
                    ? 'text-destructive border-destructive text-xs'
                    : 'text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning))] text-xs'
                }>
                  {stopStatusLabels[stop.status]}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>

        <p className="text-xs text-muted-foreground">
          Las paradas completadas se mantendrán como están. Solo se reanudarán las fallidas y omitidas.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleResume} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            Reanudar ruta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

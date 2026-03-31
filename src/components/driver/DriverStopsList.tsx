import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Navigation, SkipForward, XCircle, Phone, Link2, MapPin } from 'lucide-react';
import { StopActionDialog } from './StopActionDialog';
import { toast } from '@/hooks/use-toast';
import type { DriverStop } from '@/hooks/useDriverRoute';
import { useUpdateStopStatus } from '@/hooks/useUpdateStopStatus';

interface DriverStopsListProps {
  stops: DriverStop[];
  routeStatus: 'draft' | 'published' | 'in_progress' | 'done';
  routeId: string;
  companyId: string;
  onStopCompleted?: () => void;
}

const statusConfig: Record<string, { icon: string; label: string; color: string }> = {
  pending:  { icon: '🔵', label: 'Pendiente', color: 'text-muted-foreground border-muted' },
  arrived:  { icon: '📍', label: 'En sitio',  color: 'text-primary border-primary' },
  done:     { icon: '✅', label: 'Entregada', color: 'text-[hsl(var(--status-active))] border-[hsl(var(--status-active))]' },
  skipped:  { icon: '⏭️', label: 'Omitida',   color: 'text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning))]' },
  failed:   { icon: '❌', label: 'Fallida',   color: 'text-destructive border-destructive' },
};

export function DriverStopsList({ stops, routeStatus, routeId, companyId, onStopCompleted }: DriverStopsListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState<DriverStop | null>(null);
  const [selectedAction, setSelectedAction] = useState<'done' | 'skipped' | 'failed'>('done');
  const { mutate: updateStatus } = useUpdateStopStatus();

  // BUG 2 FIX: When route is still 'published' (not started), mask all stop
  // statuses as 'pending' to avoid showing stale test data to the driver.
  const isRouteStarted = ['in_progress', 'done'].includes(routeStatus);
  const displayStops = isRouteStarted
    ? stops
    : stops.map(s => ({ ...s, status: 'pending' as const }));

  const handleAction = (stop: DriverStop, action: 'done' | 'skipped' | 'failed') => {
    setSelectedStop(stop);
    setSelectedAction(action);
    setDialogOpen(true);
  };

  const handleArrived = (stopId: string) => {
    updateStatus(
      { stopId, status: 'arrived' },
      { onSuccess: () => onStopCompleted?.() }
    );
  };

  const handleCopyTrackingLink = (token: string | null) => {
    if (!token) return;
    const url = `${window.location.origin}/track/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copiado', description: 'Link de seguimiento copiado al portapapeles.' });
  };

  const isRouteActive = ['in_progress', 'published'].includes(routeStatus);

  return (
    <>
      {/* Section header */}
      <div className="flex items-center gap-2 px-1 mb-1">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          Paradas ({stops.length})
        </span>
      </div>

      <div className="space-y-2">
        {displayStops.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Navigation className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay paradas programadas</p>
          </div>
        ) : (
          displayStops.map((stop, index) => {
            // Use the original stop's actual status for action logic,
            // but the displayStop's status for visuals.
            const originalStop = stops[index];
            const displayStatus = stop.status;

            const isDone    = displayStatus === 'done';
            const isSkipped = displayStatus === 'skipped';
            const isFailed  = displayStatus === 'failed';
            const isArrived = displayStatus === 'arrived';
            const isResolved = isDone || isSkipped || isFailed;
            const isPendingStop = displayStatus === 'pending';
            const isNextStop = isPendingStop && displayStops.slice(0, index).every(s => s.status !== 'pending');
            const cfg = statusConfig[displayStatus] || statusConfig.pending;

            return (
              <div
                key={stop.id}
                className={`flex flex-col gap-2 p-3 rounded-lg border transition-all min-h-[60px] ${
                  isDone    ? 'bg-[hsl(var(--status-active))]/10 border-[hsl(var(--status-active))]/30'
                  : isSkipped ? 'bg-[hsl(var(--status-warning))]/10 border-[hsl(var(--status-warning))]/30'
                  : isFailed  ? 'bg-destructive/10 border-destructive/30'
                  : isArrived ? 'bg-primary/10 border-primary/40'
                  : isNextStop ? 'bg-primary/5 border-primary/30'
                  : 'bg-muted/30 border-border'
                }`}
              >
                {/* Row 1: seq number / icon + address + badge */}
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${
                    isDone    ? 'bg-[hsl(var(--status-active))] text-white'
                    : isSkipped ? 'bg-[hsl(var(--status-warning))] text-white'
                    : isFailed  ? 'bg-destructive text-destructive-foreground'
                    : isArrived ? 'bg-primary text-primary-foreground'
                    : isNextStop ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                    {isResolved ? <span className="text-xs">{cfg.icon}</span> : <span className="text-xs font-bold">{stop.seq}</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-tight ${isResolved ? 'line-through text-muted-foreground' : ''}`}>
                      {stop.address_text}
                    </p>
                    {stop.recipient_name && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{stop.recipient_name}</p>
                    )}
                    {originalStop.failure_reason && isFailed && (
                      <p className="text-xs text-destructive mt-0.5 truncate">↳ {originalStop.failure_reason}</p>
                    )}
                    {stop.notes && !stop.recipient_name && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{stop.notes}</p>
                    )}
                  </div>

                  {/* Badge + tracking link */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {(isResolved || isArrived) && (
                      <Badge variant="outline" className={`text-xs whitespace-nowrap ${cfg.color}`}>
                        {cfg.label}
                      </Badge>
                    )}
                    {stop.tracking_token && (
                      <button
                        onClick={() => handleCopyTrackingLink(stop.tracking_token)}
                        className="text-muted-foreground hover:text-primary p-1 -m-1"
                        title="Copiar link de seguimiento"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2: phone */}
                {stop.recipient_phone && (
                  <div className="ml-11">
                    <a
                      href={`tel:${stop.recipient_phone}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {stop.recipient_phone}
                    </a>
                  </div>
                )}

                {/* Row 3: action buttons — pending stop */}
                {isRouteActive && isPendingStop && (
                  <div className="flex gap-2 ml-11 flex-wrap">
                    <Button
                      size="sm" variant="outline"
                      onClick={() => handleArrived(originalStop.id)}
                      className="border-primary text-primary min-h-[48px]"
                    >
                      <Navigation className="h-4 w-4 mr-1" />
                      Llegué
                    </Button>
                    <Button
                      size="sm"
                      variant={isNextStop ? 'default' : 'outline'}
                      onClick={() => handleAction(originalStop, 'done')}
                      className={`min-h-[48px] flex-1 ${isNextStop ? 'bg-[hsl(var(--status-active))] hover:bg-[hsl(var(--status-active))]/90' : ''}`}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Entregar
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => handleAction(originalStop, 'skipped')}
                      className="border-[hsl(var(--status-warning))] text-[hsl(var(--status-warning))] min-h-[44px]"
                      title="Omitir"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => handleAction(originalStop, 'failed')}
                      className="border-destructive text-destructive min-h-[44px]"
                      title="No entregado"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Row 3: action buttons — arrived stop */}
                {isRouteActive && isArrived && (
                  <div className="flex gap-2 ml-11 flex-wrap">
                    <Button
                      size="sm" variant="default"
                      onClick={() => handleAction(originalStop, 'done')}
                      className="bg-[hsl(var(--status-active))] hover:bg-[hsl(var(--status-active))]/90 flex-1 min-h-[48px]"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Entregar
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => handleAction(originalStop, 'skipped')}
                      className="border-[hsl(var(--status-warning))] text-[hsl(var(--status-warning))] min-h-[44px]"
                      title="Omitir"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => handleAction(originalStop, 'failed')}
                      className="border-destructive text-destructive min-h-[44px]"
                      title="No entregado"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <StopActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stop={selectedStop}
        action={selectedAction}
        companyId={companyId}
        routeId={routeId}
        onCompleted={onStopCompleted}
      />
    </>
  );
}

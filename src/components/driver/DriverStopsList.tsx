import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, CheckCircle2, Loader2, Navigation, SkipForward, XCircle } from 'lucide-react';
import { StopActionDialog } from './StopActionDialog';

interface Stop {
  id: string;
  seq: number;
  address_text: string;
  status: 'pending' | 'arrived' | 'done' | 'skipped' | 'failed';
  lat: number | null;
  lng: number | null;
  notes: string | null;
}

interface DriverStopsListProps {
  stops: Stop[];
  routeStatus: 'draft' | 'published' | 'in_progress' | 'done';
  routeId: string;
  companyId: string;
  onStopCompleted?: () => void;
}

const statusConfig: Record<string, { icon: string; label: string; color: string }> = {
  pending: { icon: '🔵', label: 'Pendiente', color: 'text-muted-foreground border-muted' },
  arrived: { icon: '📍', label: 'En sitio', color: 'text-primary border-primary' },
  done: { icon: '✅', label: 'Entregada', color: 'text-[hsl(var(--status-active))] border-[hsl(var(--status-active))]' },
  skipped: { icon: '⏭️', label: 'Omitida', color: 'text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning))]' },
  failed: { icon: '❌', label: 'Fallida', color: 'text-destructive border-destructive' },
};

export function DriverStopsList({ stops, routeStatus, routeId, companyId, onStopCompleted }: DriverStopsListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [selectedAction, setSelectedAction] = useState<'done' | 'skipped' | 'failed'>('done');

  const handleAction = (stop: Stop, action: 'done' | 'skipped' | 'failed') => {
    setSelectedStop(stop);
    setSelectedAction(action);
    setDialogOpen(true);
  };

  const completedCount = stops.filter(s => s.status === 'done').length;
  const totalStops = stops.length;
  const progressPercent = totalStops > 0 ? Math.round((completedCount / totalStops) * 100) : 0;
  const isRouteActive = routeStatus === 'in_progress';

  return (
    <>
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Paradas del día
            </div>
            <Badge variant="secondary">
              {completedCount}/{totalStops} ({progressPercent}%)
            </Badge>
          </CardTitle>
          {totalStops > 0 && (
            <Progress value={progressPercent} className="h-2 mt-2" />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[400px]">
            <div className="p-4 space-y-2">
              {stops.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Navigation className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay paradas programadas</p>
                </div>
              ) : (
                stops.map((stop, index) => {
                  const isDone = stop.status === 'done';
                  const isSkipped = stop.status === 'skipped';
                  const isFailed = stop.status === 'failed';
                  const isResolved = isDone || isSkipped || isFailed;
                  const isPendingStop = stop.status === 'pending';
                  const isNextStop = isPendingStop &&
                    stops.slice(0, index).every(s => s.status !== 'pending');
                  const cfg = statusConfig[stop.status] || statusConfig.pending;

                  return (
                    <div
                      key={stop.id}
                      className={`
                        flex flex-col gap-2 p-3 rounded-lg border transition-all
                        ${isDone
                          ? 'bg-[hsl(var(--status-active))]/10 border-[hsl(var(--status-active))]/30'
                          : isSkipped
                            ? 'bg-[hsl(var(--status-warning))]/10 border-[hsl(var(--status-warning))]/30'
                            : isFailed
                              ? 'bg-destructive/10 border-destructive/30'
                              : isNextStop
                                ? 'bg-primary/5 border-primary/30'
                                : 'bg-muted/30 border-border'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                          ${isDone
                            ? 'bg-[hsl(var(--status-active))] text-white'
                            : isSkipped
                              ? 'bg-[hsl(var(--status-warning))] text-white'
                              : isFailed
                                ? 'bg-destructive text-destructive-foreground'
                                : isNextStop
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                          }
                        `}>
                          {isResolved ? (
                            <span className="text-xs">{cfg.icon}</span>
                          ) : (
                            stop.seq
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isResolved ? 'line-through text-muted-foreground' : ''}`}>
                            {stop.address_text}
                          </p>
                          {stop.notes && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {stop.notes}
                            </p>
                          )}
                        </div>

                        {isResolved && (
                          <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                        )}
                      </div>

                      {isRouteActive && isPendingStop && (
                        <div className="flex gap-2 ml-11">
                          <Button
                            size="sm"
                            variant={isNextStop ? "default" : "outline"}
                            onClick={() => handleAction(stop, 'done')}
                            className={isNextStop ? 'bg-[hsl(var(--status-active))] hover:bg-[hsl(var(--status-active))]/90 flex-1' : 'flex-1'}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Entregar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(stop, 'skipped')}
                            className="border-[hsl(var(--status-warning))] text-[hsl(var(--status-warning))]"
                          >
                            <SkipForward className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(stop, 'failed')}
                            className="border-destructive text-destructive"
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
          </ScrollArea>
        </CardContent>
      </Card>

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

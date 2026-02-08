import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, CheckCircle2, Clock, Loader2, Navigation } from 'lucide-react';
import { useUpdateStopStatus } from '@/hooks/useUpdateStopStatus';

interface Stop {
  id: string;
  seq: number;
  address_text: string;
  status: 'pending' | 'arrived' | 'done' | 'skipped';
  lat: number | null;
  lng: number | null;
  notes: string | null;
}

interface DriverStopsListProps {
  stops: Stop[];
  routeStatus: 'draft' | 'published' | 'in_progress' | 'done';
  onStopCompleted?: () => void;
}

export function DriverStopsList({ stops, routeStatus, onStopCompleted }: DriverStopsListProps) {
  const { mutate: updateStopStatus, isPending } = useUpdateStopStatus();

  const handleMarkComplete = (stopId: string) => {
    updateStopStatus(
      { stopId, status: 'done' },
      { onSuccess: () => onStopCompleted?.() }
    );
  };

  const completedCount = stops.filter(s => s.status === 'done').length;
  const isRouteActive = routeStatus === 'in_progress';

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Paradas del día
          </div>
          <Badge variant="secondary">
            {completedCount}/{stops.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[300px]">
          <div className="p-4 space-y-2">
            {stops.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Navigation className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay paradas programadas</p>
              </div>
            ) : (
              stops.map((stop, index) => {
                const isDone = stop.status === 'done';
                const isPendingStop = stop.status === 'pending';
                const isNextStop = isPendingStop && 
                  stops.slice(0, index).every(s => s.status === 'done' || s.status === 'skipped');

                return (
                  <div
                    key={stop.id}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border transition-all
                      ${isDone 
                        ? 'bg-status-active/10 border-status-active/30' 
                        : isNextStop 
                          ? 'bg-primary/5 border-primary/30' 
                          : 'bg-muted/30 border-border'
                      }
                    `}
                  >
                    {/* Sequence number */}
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                      ${isDone 
                        ? 'bg-status-active text-white' 
                        : isNextStop 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                      }
                    `}>
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        stop.seq
                      )}
                    </div>

                    {/* Address */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                        {stop.address_text}
                      </p>
                      {stop.notes && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {stop.notes}
                        </p>
                      )}
                    </div>

                    {/* Action button */}
                    {isRouteActive && isPendingStop && (
                      <Button
                        size="sm"
                        variant={isNextStop ? "default" : "outline"}
                        onClick={() => handleMarkComplete(stop.id)}
                        disabled={isPending}
                        className={isNextStop ? 'bg-status-active hover:bg-status-active/90' : ''}
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    {/* Done badge */}
                    {isDone && (
                      <Badge variant="outline" className="text-status-active border-status-active">
                        <Clock className="h-3 w-3 mr-1" />
                        Entregada
                      </Badge>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

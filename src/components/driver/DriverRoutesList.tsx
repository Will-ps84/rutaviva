import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Route, CalendarDays, ChevronRight } from 'lucide-react';
import { useDriverRoutes, type DriverRouteListItem } from '@/hooks/useDriverRoutes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DriverRoutesListProps {
  onSelectRoute: (routeId: string) => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  published: { label: 'Asignada', className: 'bg-primary/10 text-primary border-primary/30' },
  in_progress: { label: 'En progreso', className: 'bg-[hsl(var(--status-warning))]/10 text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning))]/30' },
  done: { label: 'Completada', className: 'bg-[hsl(var(--status-active))]/10 text-[hsl(var(--status-active))] border-[hsl(var(--status-active))]/30' },
};

type FilterType = 'today' | 'week' | 'all';

export function DriverRoutesList({ onSelectRoute }: DriverRoutesListProps) {
  const [filter, setFilter] = useState<FilterType>('today');
  const { data: routes, isLoading } = useDriverRoutes(filter);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Route className="h-4 w-4" />
          Mis Rutas
        </CardTitle>
        <div className="flex gap-1 mt-2">
          {(['today', 'week', 'all'] as FilterType[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => setFilter(f)}
            >
              {f === 'today' ? 'Hoy' : f === 'week' ? '7 días' : 'Todas'}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[300px]">
          <div className="p-4 space-y-2">
            {isLoading ? (
              <p className="text-center text-sm text-muted-foreground py-4">Cargando...</p>
            ) : !routes?.length ? (
              <div className="text-center py-6 text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay rutas en este período</p>
              </div>
            ) : (
              routes.map((route) => {
                const cfg = statusConfig[route.status] || statusConfig.published;
                const pct = route.totalStops > 0 ? Math.round((route.doneStops / route.totalStops) * 100) : 0;

                return (
                  <button
                    key={route.id}
                    onClick={() => onSelectRoute(route.id)}
                    className="w-full text-left p-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-all flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{route.name}</span>
                        <Badge variant="outline" className={`text-xs ${cfg.className}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{format(new Date(route.date), "d MMM yyyy", { locale: es })}</span>
                        <span>{route.doneStops}/{route.totalStops} paradas</span>
                      </div>
                      {route.totalStops > 0 && (
                        <Progress value={pct} className="h-1.5 mt-1.5" />
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

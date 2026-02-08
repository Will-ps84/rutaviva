import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Route, User, Truck, MapPin, Clock } from 'lucide-react';
import { ActiveRoute, formatTimeSince, getDriverStatus } from '@/hooks/useDispatchData';

interface ActiveRoutesListProps {
  routes: ActiveRoute[];
  selectedRouteId: string | null;
  onRouteSelect: (routeId: string | null) => void;
}

export function ActiveRoutesList({
  routes,
  selectedRouteId,
  onRouteSelect,
}: ActiveRoutesListProps) {
  if (routes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Route className="h-5 w-5" />
            Rutas Activas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Route className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No hay rutas activas</p>
            <p className="text-sm">Las rutas publicadas o en progreso aparecerán aquí</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Route className="h-5 w-5" />
          Rutas Activas
          <Badge variant="secondary" className="ml-auto">
            {routes.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-3">
            {routes.map((route) => {
              const isSelected = selectedRouteId === route.id;
              const lastLocation = route.last_location;
              const driverStatus = lastLocation 
                ? getDriverStatus(lastLocation.recorded_at) 
                : null;

              return (
                <div
                  key={route.id}
                  onClick={() => onRouteSelect(isSelected ? null : route.id)}
                  className={`
                    p-4 rounded-lg border cursor-pointer transition-all
                    ${isSelected 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }
                  `}
                >
                  {/* Route Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{route.name}</h4>
                      <Badge 
                        variant={route.status === 'in_progress' ? 'default' : 'secondary'}
                        className="mt-1"
                      >
                        {route.status === 'in_progress' ? 'En Progreso' : 'Publicada'}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {route.progress_percent}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {route.completed_stops}/{route.total_stops} paradas
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <Progress 
                    value={route.progress_percent} 
                    className="h-2 mb-3"
                  />

                  {/* Route Details */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span className="truncate">
                        {route.driver_name || 'Sin asignar'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Truck className="h-3.5 w-3.5" />
                      <span className="truncate">
                        {route.vehicle_plate || 'Sin vehículo'}
                      </span>
                    </div>
                  </div>

                  {/* Last Location */}
                  {lastLocation && (
                    <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${
                          driverStatus === 'active' ? 'bg-status-active animate-pulse' :
                          driverStatus === 'stopped' ? 'bg-status-warning' : 'bg-muted-foreground'
                        }`} />
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {lastLocation.lat.toFixed(4)}, {lastLocation.lng.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        hace {formatTimeSince(lastLocation.recorded_at)}
                      </div>
                    </div>
                  )}

                  {!lastLocation && route.driver_id && (
                    <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                      Sin ubicación reciente
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

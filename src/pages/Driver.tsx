import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { 
  Play, 
  Pause, 
  Square, 
  MapPin, 
  Signal, 
  Clock,
  Truck,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type RouteStatus = 'idle' | 'active' | 'paused';

export default function Driver() {
  const { user, loading, signOut } = useAuth();
  const [routeStatus, setRouteStatus] = useState<RouteStatus>('idle');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleStartRoute = () => {
    setRouteStatus('active');
    setLastUpdate(new Date());
  };

  const handlePauseRoute = () => {
    setRouteStatus('paused');
  };

  const handleResumeRoute = () => {
    setRouteStatus('active');
    setLastUpdate(new Date());
  };

  const handleEndRoute = () => {
    setRouteStatus('idle');
    setLastUpdate(null);
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">RutaViva</h1>
            <p className="text-xs text-muted-foreground">Modo Conductor</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      {/* Status card */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            Estado de la ruta
            <Badge 
              variant="outline"
              className={
                routeStatus === 'active' 
                  ? 'status-active' 
                  : routeStatus === 'paused' 
                    ? 'status-warning' 
                    : 'status-inactive'
              }
            >
              {routeStatus === 'active' && 'En ruta'}
              {routeStatus === 'paused' && 'Pausada'}
              {routeStatus === 'idle' && 'Sin iniciar'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {routeStatus !== 'idle' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Signal className="h-4 w-4 text-status-active" />
                  <span>GPS Activo</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {lastUpdate 
                      ? `Hace ${Math.floor((Date.now() - lastUpdate.getTime()) / 1000)}s`
                      : 'Sin datos'
                    }
                  </span>
                </div>
              </div>
            )}

            {routeStatus === 'idle' && (
              <p className="text-center text-muted-foreground py-4">
                Presiona "Iniciar ruta" para comenzar el tracking
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current stop placeholder */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Próxima parada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No hay ruta asignada</p>
            <p className="text-sm">La información de paradas aparecerá aquí</p>
          </div>
        </CardContent>
      </Card>

      {/* Map placeholder */}
      <Card className="h-[200px] mb-6">
        <CardContent className="p-0 h-full">
          <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Mapa disponible en Etapa 3
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fixed bottom controls */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <div className="max-w-md mx-auto">
          {routeStatus === 'idle' && (
            <Button 
              className="w-full h-14 text-lg gap-2" 
              onClick={handleStartRoute}
            >
              <Play className="h-6 w-6" />
              Iniciar Ruta
            </Button>
          )}

          {routeStatus === 'active' && (
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="h-14 text-lg gap-2"
                onClick={handlePauseRoute}
              >
                <Pause className="h-5 w-5" />
                Pausar
              </Button>
              <Button 
                variant="destructive" 
                className="h-14 text-lg gap-2"
                onClick={handleEndRoute}
              >
                <Square className="h-5 w-5" />
                Finalizar
              </Button>
            </div>
          )}

          {routeStatus === 'paused' && (
            <div className="grid grid-cols-2 gap-3">
              <Button 
                className="h-14 text-lg gap-2"
                onClick={handleResumeRoute}
              >
                <Play className="h-5 w-5" />
                Continuar
              </Button>
              <Button 
                variant="destructive" 
                className="h-14 text-lg gap-2"
                onClick={handleEndRoute}
              >
                <Square className="h-5 w-5" />
                Finalizar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

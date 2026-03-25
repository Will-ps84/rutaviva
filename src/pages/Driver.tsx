import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { driverLogout } from '@/services/driverAuth';
import {
  Play, Pause, Square, MapPin, Signal, Clock, Truck, LogOut,
  Navigation, AlertCircle, CheckCircle2, Loader2, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDriverProfile, useDriverTodayRoute, useUpdateRouteStatus } from '@/hooks/useDriverRoute';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { toast } from '@/hooks/use-toast';
import { DriverStopsList } from '@/components/driver/DriverStopsList';
import { DriverRoutesList } from '@/components/driver/DriverRoutesList';

type TrackingStatus = 'idle' | 'active' | 'paused';

export default function Driver() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: profile, isLoading: profileLoading } = useDriverProfile();
  const { data: todayRoute, isLoading: routeLoading, refetch: refetchRoute } = useDriverTodayRoute();
  const { updateStatus, reactivateRoute } = useUpdateRouteStatus();
  const [isReactivating, setIsReactivating] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>('idle');

  const {
    position, isTracking, permissionStatus, lastSentAt, sendCount, sendError,
    startTracking, stopTracking, requestPermission,
  } = useLocationTracking({
    driverId: user?.id || '',
    companyId: profile?.company_id || '',
    routeId: todayRoute?.id,
    throttleMs: 5000,
  });

  useEffect(() => {
    if (isTracking && trackingStatus === 'idle') setTrackingStatus('active');
  }, [isTracking, trackingStatus]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/driver/login" replace />;

  // Block tracking start if no valid route
  const hasActiveRoute = todayRoute && ['published', 'in_progress'].includes(todayRoute.status);

  const handleStartRoute = async () => {
    if (!hasActiveRoute) {
      toast({
        title: '⚠️ Sin ruta asignada',
        description: 'No tienes rutas asignadas. Contacta a tu administrador.',
        variant: 'destructive',
      });
      return;
    }
    const granted = await requestPermission();
    if (!granted) {
      toast({ title: 'Permiso requerido', description: 'Necesitas permitir el acceso a tu ubicación.', variant: 'destructive' });
      return;
    }
    if (todayRoute.status === 'published') {
      try { await updateStatus(todayRoute.id, 'in_progress'); refetchRoute(); } catch { /* silent */ }
    }
    startTracking();
    setTrackingStatus('active');
    toast({ title: '🚀 Tracking iniciado', description: `Enviando GPS con ruta: ${todayRoute.name}` });
  };

  const handleReactivateRoute = async () => {
    if (!todayRoute) return;
    setIsReactivating(true);
    const granted = await requestPermission();
    if (!granted) {
      toast({ title: 'Permiso requerido', description: 'Necesitas permitir el acceso a tu ubicación.', variant: 'destructive' });
      setIsReactivating(false);
      return;
    }
    try {
      await reactivateRoute(todayRoute.id);
      refetchRoute();
      startTracking();
      setTrackingStatus('active');
      toast({ title: 'Ruta retomada', description: 'Tu ubicación se está enviando nuevamente.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo retomar la ruta.', variant: 'destructive' });
    } finally {
      setIsReactivating(false);
    }
  };

  const handlePauseRoute = () => { stopTracking(); setTrackingStatus('paused'); toast({ title: 'Tracking pausado' }); };
  const handleResumeRoute = () => { startTracking(); setTrackingStatus('active'); toast({ title: 'Tracking reanudado' }); };

  const handleEndRoute = async () => {
    stopTracking();
    setTrackingStatus('idle');
    if (todayRoute && todayRoute.status === 'in_progress') {
      try { await updateStatus(todayRoute.id, 'done'); refetchRoute(); } catch { /* silent */ }
    }
    toast({ title: 'Ruta finalizada', description: `Se enviaron ${sendCount} puntos de ubicación.` });
  };

  const handleSelectRoute = (_routeId: string) => { refetchRoute(); };

  const getStatusBadge = () => {
    switch (trackingStatus) {
      case 'active': return <Badge className="bg-[hsl(var(--status-active))] text-white">En Ruta</Badge>;
      case 'paused': return <Badge className="bg-[hsl(var(--status-warning))] text-white">Pausado</Badge>;
      default: return <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>;
    }
  };

  const formatTimeSince = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const completedStops = todayRoute?.stops?.filter(s => s.status === 'done').length ?? 0;
  const totalStops = todayRoute?.stops?.length ?? 0;

  return (
    <div className="min-h-screen bg-background p-4 pb-32">
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
        <Button variant="ghost" size="icon" onClick={() => { driverLogout(); navigate('/choose-mode'); }}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      {/* Driver Info */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Conductor</p>
              <p className="font-semibold">{profile?.full_name || 'Sin nombre'}</p>
            </div>
            {getStatusBadge()}
          </div>
        </CardContent>
      </Card>

      {/* My Routes List */}
      <DriverRoutesList onSelectRoute={handleSelectRoute} />

      {/* Active Route Card */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            Ruta Activa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {routeLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : todayRoute ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{todayRoute.name}</span>
                <Badge variant="outline" className={todayRoute.status === 'done' ? 'bg-[hsl(var(--status-active))]/10 text-[hsl(var(--status-active))] border-[hsl(var(--status-active))]' : ''}>
                  {todayRoute.status === 'done' ? 'Completada' : `${totalStops} paradas`}
                </Badge>
              </div>
              {totalStops > 0 && (
                <div className="text-sm text-muted-foreground">
                  {completedStops} de {totalStops} completadas
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive opacity-70" />
              <p className="font-medium text-destructive">No tienes rutas asignadas</p>
              <p className="text-xs text-muted-foreground mt-1">Contacta a tu administrador.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* GPS Status */}
      {trackingStatus !== 'idle' && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Signal className={trackingStatus === 'active' ? 'text-[hsl(var(--status-active))]' : 'text-[hsl(var(--status-warning))]'} />
              Estado del GPS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                {trackingStatus === 'active'
                  ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-active))]" />
                  : <Pause className="h-4 w-4 text-[hsl(var(--status-warning))]" />}
                <span>{trackingStatus === 'active' ? 'Enviando' : 'Pausado'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{lastSentAt ? `Hace ${formatTimeSince(lastSentAt)}` : 'Esperando...'}</span>
              </div>
              {position && (
                <>
                  <div className="col-span-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 inline mr-1" />
                    {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
                  </div>
                  <div className="text-xs text-muted-foreground">Precisión: {position.accuracy?.toFixed(0)}m</div>
                  <div className="text-xs text-muted-foreground">Puntos: {sendCount}</div>
                </>
              )}
              {sendError && <div className="col-span-2 text-xs text-destructive">Error: {sendError}</div>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stops List */}
      {todayRoute && todayRoute.stops.length > 0 && (
        <DriverStopsList
          stops={todayRoute.stops}
          routeStatus={todayRoute.status}
          routeId={todayRoute.id}
          companyId={profile?.company_id || ''}
          onStopCompleted={() => refetchRoute()}
        />
      )}

      {/* Permission Warning */}
      {permissionStatus === 'denied' && (
        <Card className="mb-4 border-destructive">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Ubicación bloqueada</p>
                <p className="text-xs">Habilita el GPS en tu navegador</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fixed Bottom Controls */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border safe-area-bottom z-50">
        <div className="max-w-md mx-auto space-y-2">
          <div className="text-center text-sm text-muted-foreground mb-2">
            {trackingStatus === 'idle' && (hasActiveRoute ? 'Presiona para comenzar el tracking GPS' : 'Sin ruta activa asignada')}
            {trackingStatus === 'active' && 'Enviando ubicación cada 5 segundos...'}
            {trackingStatus === 'paused' && 'Tracking pausado'}
          </div>

          {trackingStatus === 'idle' && todayRoute?.status === 'done' && (
            <Button className="w-full h-16 text-xl gap-3 font-bold shadow-lg" onClick={handleReactivateRoute} disabled={permissionStatus === 'denied' || isReactivating}>
              {isReactivating ? <Loader2 className="h-7 w-7 animate-spin" /> : <RotateCcw className="h-7 w-7" />}
              RETOMAR RUTA
            </Button>
          )}

          {trackingStatus === 'idle' && todayRoute?.status !== 'done' && (
            <Button
              className="w-full h-16 text-xl gap-3 bg-[hsl(var(--status-active))] hover:bg-[hsl(var(--status-active))]/90 text-white font-bold shadow-lg disabled:opacity-50"
              onClick={handleStartRoute}
              disabled={permissionStatus === 'denied' || !hasActiveRoute}
            >
              <Play className="h-7 w-7" /> INICIAR RUTA
            </Button>
          )}

          {trackingStatus === 'active' && (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-16 text-lg gap-2 border-2 border-[hsl(var(--status-warning))] text-[hsl(var(--status-warning))] font-semibold" onClick={handlePauseRoute}>
                <Pause className="h-6 w-6" /> PAUSAR
              </Button>
              <Button className="h-16 text-lg gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold" onClick={handleEndRoute}>
                <Square className="h-6 w-6" /> FINALIZAR
              </Button>
            </div>
          )}

          {trackingStatus === 'paused' && (
            <div className="grid grid-cols-2 gap-3">
              <Button className="h-16 text-lg gap-2 bg-[hsl(var(--status-active))] hover:bg-[hsl(var(--status-active))]/90 text-white font-semibold" onClick={handleResumeRoute}>
                <Play className="h-6 w-6" /> CONTINUAR
              </Button>
              <Button className="h-16 text-lg gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold" onClick={handleEndRoute}>
                <Square className="h-6 w-6" /> FINALIZAR
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

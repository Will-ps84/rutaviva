import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { driverLogout } from '@/services/driverAuth';
import {
  Play, Pause, Square, MapPin, Signal, Clock, Truck, LogOut,
  Navigation, AlertCircle, CheckCircle2, Loader2, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

  if (!profileLoading && profile && !profile.company_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Cuenta incompleta</h2>
          <p className="text-muted-foreground text-sm">Tu cuenta no está asociada a ninguna empresa. Contacta a tu administrador.</p>
          <Button variant="outline" onClick={() => { driverLogout(); navigate('/choose-mode'); }}>
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  const hasActiveRoute = todayRoute && ['published', 'in_progress'].includes(todayRoute.status);

  const handleStartRoute = async () => {
    if (!hasActiveRoute) {
      toast({ title: '⚠️ Sin ruta asignada', description: 'No tienes rutas asignadas.', variant: 'destructive' });
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
    toast({ title: '🚀 Tracking iniciado', description: `Ruta: ${todayRoute.name}` });
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

  const formatTimeSince = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const completedStops = todayRoute?.stops?.filter(s => s.status === 'done').length ?? 0;
  const totalStops = todayRoute?.stops?.length ?? 0;
  const progressPercent = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  const getTrackingBadge = () => {
    if (trackingStatus === 'active') return <Badge className="bg-[hsl(var(--status-active))] text-white text-xs">En Ruta</Badge>;
    if (trackingStatus === 'paused') return <Badge className="bg-[hsl(var(--status-warning))] text-white text-xs">Pausado</Badge>;
    return null;
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">

      {/* ── HEADER FIJO ── */}
      <div className="flex-shrink-0 bg-background border-b border-border px-4 pt-4 pb-3 space-y-2">

        {/* Top bar: logo + nombre + logout */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Truck className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate max-w-[160px]">
                {profile?.full_name || 'Conductor'}
              </p>
              <p className="text-xs text-muted-foreground leading-tight">Modo Conductor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getTrackingBadge()}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { driverLogout(); navigate('/choose-mode'); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Ruta activa + progreso */}
        {routeLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="h-3 w-3 animate-spin" /> Cargando ruta...
          </div>
        ) : todayRoute ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Navigation className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="text-sm font-medium truncate">{todayRoute.name}</span>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {completedStops}/{totalStops} ({progressPercent}%)
              </span>
            </div>
            {totalStops > 0 && <Progress value={progressPercent} className="h-1.5" />}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-destructive text-xs">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Sin ruta asignada — contacta a tu admin</span>
          </div>
        )}

        {/* GPS status compacto cuando está activo */}
        {trackingStatus !== 'idle' && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/40 rounded-md px-2.5 py-1.5">
            <div className="flex items-center gap-1">
              <Signal className={`h-3 w-3 ${trackingStatus === 'active' ? 'text-[hsl(var(--status-active))]' : 'text-[hsl(var(--status-warning))]'}`} />
              <span>{trackingStatus === 'active' ? 'Enviando GPS' : 'GPS pausado'}</span>
            </div>
            {lastSentAt && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>hace {formatTimeSince(lastSentAt)}</span>
              </div>
            )}
            {position && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{sendCount} pts · {position.accuracy?.toFixed(0)}m</span>
              </div>
            )}
            {sendError && <span className="text-destructive truncate">{sendError}</span>}
          </div>
        )}

        {/* Permission warning */}
        {permissionStatus === 'denied' && (
          <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 rounded-md px-2.5 py-1.5">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Ubicación bloqueada — habilita el GPS en tu navegador</span>
          </div>
        )}
      </div>

      {/* ── CUERPO SCROLLABLE ── */}
      <div className="flex-1 overflow-y-auto pb-28">
        <div className="px-4 pt-3 space-y-3">

          {/* Mis rutas */}
          <DriverRoutesList onSelectRoute={handleSelectRoute} />

          {/* Lista de paradas */}
          {todayRoute && todayRoute.stops.length > 0 && (
            <DriverStopsList
              stops={todayRoute.stops}
              routeStatus={todayRoute.status}
              routeId={todayRoute.id}
              companyId={profile?.company_id || ''}
              onStopCompleted={() => refetchRoute()}
            />
          )}

          {!todayRoute && !routeLoading && (
            <div className="text-center py-12">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive opacity-60" />
              <p className="font-medium text-destructive">No tienes rutas asignadas</p>
              <p className="text-xs text-muted-foreground mt-1">Contacta a tu administrador.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTROLES FIJOS AL FONDO ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border px-4 py-3 z-50">
        <div className="max-w-md mx-auto space-y-2">
          <p className="text-center text-xs text-muted-foreground">
            {trackingStatus === 'idle' && (hasActiveRoute ? 'Presiona para comenzar el tracking GPS' : 'Sin ruta activa asignada')}
            {trackingStatus === 'active' && 'Enviando ubicación cada 5 segundos...'}
            {trackingStatus === 'paused' && 'Tracking pausado'}
          </p>

          {trackingStatus === 'idle' && todayRoute?.status === 'done' && (
            <Button
              className="w-full h-14 text-lg gap-2 font-bold shadow-lg"
              onClick={handleReactivateRoute}
              disabled={permissionStatus === 'denied' || isReactivating}
            >
              {isReactivating ? <Loader2 className="h-6 w-6 animate-spin" /> : <RotateCcw className="h-6 w-6" />}
              RETOMAR RUTA
            </Button>
          )}

          {trackingStatus === 'idle' && todayRoute?.status !== 'done' && (
            <Button
              className="w-full h-14 text-lg gap-2 bg-[hsl(var(--status-active))] hover:bg-[hsl(var(--status-active))]/90 text-white font-bold shadow-lg disabled:opacity-50"
              onClick={handleStartRoute}
              disabled={permissionStatus === 'denied' || !hasActiveRoute}
            >
              <Play className="h-6 w-6" /> INICIAR RUTA
            </Button>
          )}

          {trackingStatus === 'active' && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-14 text-base gap-2 border-2 border-[hsl(var(--status-warning))] text-[hsl(var(--status-warning))] font-semibold"
                onClick={handlePauseRoute}
              >
                <Pause className="h-5 w-5" /> PAUSAR
              </Button>
              <Button
                className="h-14 text-base gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                onClick={handleEndRoute}
              >
                <Square className="h-5 w-5" /> FINALIZAR
              </Button>
            </div>
          )}

          {trackingStatus === 'paused' && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="h-14 text-base gap-2 bg-[hsl(var(--status-active))] hover:bg-[hsl(var(--status-active))]/90 text-white font-semibold"
                onClick={handleResumeRoute}
              >
                <Play className="h-5 w-5" /> CONTINUAR
              </Button>
              <Button
                className="h-14 text-base gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                onClick={handleEndRoute}
              >
                <Square className="h-5 w-5" /> FINALIZAR
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

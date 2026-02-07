import { MapPin, Truck, AlertTriangle, Clock, Signal, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanySetupCard } from '@/components/company/CompanySetupCard';
import { useUserCompany } from '@/hooks/useCompany';
import { useDriverLocations } from '@/hooks/useDriverLocations';
import { RealtimeMapView } from '@/components/maps/RealtimeMapView';

export default function Dispatch() {
  const { data: company, isLoading: companyLoading } = useUserCompany();
  const { locations, stats, isLoading: locationsLoading, refetch } = useDriverLocations();
  
  // Show company setup if no company
  if (!companyLoading && !company) {
    return <CompanySetupCard />;
  }
  
  if (companyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Dashboard de Despacho</h1>
          <p className="text-muted-foreground">
            Monitorea tu flota en tiempo real - {company?.name}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refetch}
          disabled={locationsLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${locationsLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats grid - now with real data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-stat">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Ruta
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-[hsl(var(--status-active-bg))] flex items-center justify-center">
              <Truck className="h-4 w-4 text-[hsl(var(--status-active))]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">conductores activos (&lt;60s)</p>
          </CardContent>
        </Card>

        <Card className="card-stat">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Detenidos
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-[hsl(var(--status-warning-bg))] flex items-center justify-center">
              <Clock className="h-4 w-4 text-[hsl(var(--status-warning))]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stopped}</div>
            <p className="text-xs text-muted-foreground">entre 1-5 min sin movimiento</p>
          </CardContent>
        </Card>

        <Card className="card-stat">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alertas
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-[hsl(var(--status-danger-bg))] flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-danger))]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">sin resolver</p>
          </CardContent>
        </Card>

        <Card className="card-stat">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sin Señal
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-[hsl(var(--status-inactive-bg))] flex items-center justify-center">
              <Signal className="h-4 w-4 text-[hsl(var(--status-inactive))]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.noSignal}</div>
            <p className="text-xs text-muted-foreground">más de 5 min</p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Map */}
      <Card className="h-[500px] relative overflow-hidden">
        <CardHeader className="absolute top-4 left-4 z-10 bg-card/95 backdrop-blur-sm rounded-lg shadow-panel p-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Mapa en tiempo real
            {stats.total > 0 && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {stats.total} conductor{stats.total !== 1 ? 'es' : ''}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-full">
          {locationsLoading ? (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : locations.length === 0 ? (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted-foreground/10 flex items-center justify-center mx-auto">
                  <MapPin className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">
                    Sin conductores activos
                  </p>
                  <p className="text-sm text-muted-foreground/60">
                    Los conductores aparecerán cuando inicien tracking desde /driver
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <RealtimeMapView drivers={locations} className="h-full" />
          )}
        </CardContent>
      </Card>

      {/* Driver list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conductores en línea</CardTitle>
          </CardHeader>
          <CardContent>
            {locations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay conductores transmitiendo</p>
                <p className="text-sm">Inicia tracking desde /driver</p>
              </div>
            ) : (
              <div className="space-y-3">
                {locations.map((driver) => {
                  const age = (Date.now() - new Date(driver.recorded_at).getTime()) / 1000;
                  const status = age < 60 ? 'active' : age < 300 ? 'stopped' : 'noSignal';
                  const speedKmh = driver.speed_mps ? (driver.speed_mps * 3.6).toFixed(0) : '0';
                  
                  return (
                    <div 
                      key={driver.driver_id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          status === 'active' ? 'bg-status-active' : 
                          status === 'stopped' ? 'bg-status-warning' : 'bg-muted-foreground'
                        }`} />
                        <div>
                          <p className="font-medium">{driver.driver_name || 'Conductor'}</p>
                          <p className="text-xs text-muted-foreground">
                            {speedKmh} km/h • hace {age < 60 ? `${Math.round(age)}s` : `${Math.round(age / 60)}m`}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {driver.accuracy_m ? `±${Math.round(driver.accuracy_m)}m` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Alertas recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay alertas activas</p>
              <p className="text-sm">Las alertas aparecerán aquí</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

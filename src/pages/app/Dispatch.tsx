import { MapPin, Truck, AlertTriangle, Clock, Signal, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CompanySetupCard } from '@/components/company/CompanySetupCard';
import { useUserCompany } from '@/hooks/useCompany';

export default function Dispatch() {
  const { data: company, isLoading: companyLoading } = useUserCompany();
  
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
      <div>
        <h1 className="font-display text-2xl font-bold">Dashboard de Despacho</h1>
        <p className="text-muted-foreground">
          Monitorea tu flota en tiempo real - {company?.name}
        </p>
      </div>

      {/* Stats grid */}
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">conductores activos</p>
          </CardContent>
        </Card>

        <Card className="card-stat">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Parados
            </CardTitle>
            <div className="w-8 h-8 rounded-full bg-[hsl(var(--status-warning-bg))] flex items-center justify-center">
              <Clock className="h-4 w-4 text-[hsl(var(--status-warning))]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">más de 10 min</p>
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">más de 5 min</p>
          </CardContent>
        </Card>
      </div>

      {/* Map placeholder */}
      <Card className="h-[500px] relative overflow-hidden">
        <CardHeader className="absolute top-4 left-4 z-10 bg-card/95 backdrop-blur-sm rounded-lg shadow-panel p-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Mapa en tiempo real
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-full">
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted-foreground/10 flex items-center justify-center mx-auto">
                <MapPin className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <div>
                <p className="font-medium text-muted-foreground">
                  Mapa disponible en Etapa 3
                </p>
                <p className="text-sm text-muted-foreground/60">
                  Se integrará tracking en tiempo real
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Routes list placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rutas del día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay rutas programadas para hoy</p>
              <p className="text-sm">Crea una ruta desde la sección Rutas</p>
            </div>
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

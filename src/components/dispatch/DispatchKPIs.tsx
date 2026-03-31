import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, Route, TrendingUp, Signal } from 'lucide-react';

interface DispatchKPIsProps {
  activeDrivers: number;
  routesInProgress: number;
  avgProgress: number;
  noSignal: number;
}

export const DispatchKPIs = memo(function DispatchKPIs({
  activeDrivers,
  routesInProgress,
  avgProgress,
  noSignal,
}: DispatchKPIsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="card-stat">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Conductores Activos
          </CardTitle>
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--status-active-bg))] flex items-center justify-center">
            <Signal className="h-4 w-4 text-[hsl(var(--status-active))]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeDrivers}</div>
          <p className="text-xs text-muted-foreground">transmitiendo (&lt;60s)</p>
        </CardContent>
      </Card>

      <Card className="card-stat">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Rutas en Progreso
          </CardTitle>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Route className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{routesInProgress}</div>
          <p className="text-xs text-muted-foreground">rutas activas</p>
        </CardContent>
      </Card>

      <Card className="card-stat">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Avance Promedio
          </CardTitle>
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--status-active-bg))] flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--status-active))]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgProgress}%</div>
          <p className="text-xs text-muted-foreground">paradas completadas</p>
        </CardContent>
      </Card>

      <Card className="card-stat">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Sin Señal
          </CardTitle>
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--status-inactive-bg))] flex items-center justify-center">
            <Truck className="h-4 w-4 text-[hsl(var(--status-inactive))]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{noSignal}</div>
          <p className="text-xs text-muted-foreground">más de 5 min sin GPS</p>
        </CardContent>
      </Card>
    </div>
  );
});

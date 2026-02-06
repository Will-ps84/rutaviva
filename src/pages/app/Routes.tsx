import { Plus, Route as RouteIcon, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Routes() {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Gestión de Rutas</h1>
          <p className="text-muted-foreground">
            Crea y administra las rutas de reparto
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Ruta
        </Button>
      </div>

      {/* Empty state */}
      <Card>
        <CardContent className="py-16">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <RouteIcon className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">
                Aún no tienes rutas
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Crea tu primera ruta ingresando direcciones de entrega.
                Podrás asignar conductores y optimizar el recorrido.
              </p>
            </div>
            <Button className="gap-2 mt-4">
              <Plus className="h-4 w-4" />
              Crear primera ruta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-stat">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Esta semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">rutas programadas</p>
          </CardContent>
        </Card>

        <Card className="card-stat">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <RouteIcon className="h-4 w-4" />
              Completadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">este mes</p>
          </CardContent>
        </Card>

        <Card className="card-stat">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <RouteIcon className="h-4 w-4" />
              Paradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">promedio por ruta</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

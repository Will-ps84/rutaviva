import { Settings as SettingsIcon, Bell, MapPin, Clock, Wifi } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function Settings() {
  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">
          Ajusta los parámetros de alertas y tracking
        </p>
      </div>

      {/* Alert thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Umbrales de Alertas
          </CardTitle>
          <CardDescription>
            Configura cuándo se generan alertas automáticas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="stopped-time" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-status-warning" />
                Tiempo máximo parado (min)
              </Label>
              <Input
                id="stopped-time"
                type="number"
                defaultValue={10}
                min={1}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Alerta si el conductor está parado más de este tiempo
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stopped-radius" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-status-warning" />
                Radio de parada (metros)
              </Label>
              <Input
                id="stopped-radius"
                type="number"
                defaultValue={50}
                min={10}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Distancia para considerar que está en el mismo punto
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="off-route" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-status-danger" />
                Distancia fuera de ruta (metros)
              </Label>
              <Input
                id="off-route"
                type="number"
                defaultValue={500}
                min={100}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Alerta si se aleja más de esta distancia de la ruta
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="no-signal" className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-status-inactive" />
                TTL sin señal (min)
              </Label>
              <Input
                id="no-signal"
                type="number"
                defaultValue={5}
                min={1}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Alerta si no recibimos ubicación en este tiempo
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button disabled>
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tracking settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Configuración de Tracking
          </CardTitle>
          <CardDescription>
            Parámetros de recolección de ubicación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tracking-interval" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Intervalo en movimiento (seg)
              </Label>
              <Input
                id="tracking-interval"
                type="number"
                defaultValue={10}
                min={5}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Frecuencia de envío cuando el conductor está en movimiento
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tracking-idle" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Intervalo parado (seg)
              </Label>
              <Input
                id="tracking-idle"
                type="number"
                defaultValue={60}
                min={30}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Frecuencia de envío cuando el conductor está parado
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button disabled>
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API settings placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            Proveedores de Mapas y Ruteo
          </CardTitle>
          <CardDescription>
            Configura las APIs de terceros (Google Maps, Mapbox)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Disponible en Etapa 5</p>
            <p className="text-sm">Se configurará la integración con proveedores de mapas</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

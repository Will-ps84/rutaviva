import { useParams } from 'react-router-dom';
import { MapPin, Clock, Truck, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Track() {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">Seguimiento de entrega</h1>
            <p className="text-sm opacity-80">RutaViva</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Status card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Estado de tu pedido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-status-active-bg flex items-center justify-center">
                <Truck className="h-6 w-6 text-status-active" />
              </div>
              <div>
                <p className="font-medium">En camino</p>
                <p className="text-sm text-muted-foreground">
                  Tu pedido está siendo entregado
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ETA card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tiempo estimado de llegada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-3xl font-display font-bold text-primary">--:--</p>
              <p className="text-sm text-muted-foreground mt-1">
                ETA no disponible
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Map placeholder */}
        <Card className="h-[300px]">
          <CardContent className="p-0 h-full">
            <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center space-y-2">
                <MapPin className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                <div>
                  <p className="font-medium text-muted-foreground">
                    Mapa de seguimiento
                  </p>
                  <p className="text-sm text-muted-foreground/60">
                    Disponible en Etapa 3
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next stop info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Dirección de entrega
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              La dirección de entrega aparecerá aquí
            </p>
          </CardContent>
        </Card>

        {/* Token info (for debugging) */}
        <p className="text-xs text-center text-muted-foreground/50">
          Token: {token || 'No token provided'}
        </p>
      </div>
    </div>
  );
}

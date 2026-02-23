import { useNavigate } from 'react-router-dom';
import { Truck, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ChooseMode() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-hero">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-12">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-[hsl(224,89%,60%)] flex items-center justify-center shadow-lg shadow-primary/20">
          <Truck className="h-7 w-7 text-primary-foreground" />
        </div>
        <span className="font-display text-3xl font-bold text-sidebar-foreground tracking-tight">
          RutaViva
        </span>
      </div>

      <p className="text-sidebar-foreground/60 text-center mb-8 max-w-sm">
        Selecciona cómo deseas ingresar al sistema
      </p>

      <div className="grid gap-4 w-full max-w-sm">
        {/* Admin mode */}
        <Card
          className="cursor-pointer border-2 border-transparent hover:border-primary/40 transition-all bg-sidebar-accent"
          onClick={() => navigate('/admin/login')}
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Monitor className="h-6 w-6 text-sidebar-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-sidebar-foreground text-lg">
                Administrador
              </p>
              <p className="text-sm text-sidebar-foreground/50">
                Gestión de rutas, conductores y reportes
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Driver mode */}
        <Card
          className="cursor-pointer border-2 border-transparent hover:border-primary/40 transition-all bg-sidebar-accent"
          onClick={() => navigate('/driver/login')}
        >
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-lg bg-[hsl(var(--status-active))]/20 flex items-center justify-center flex-shrink-0">
              <Smartphone className="h-6 w-6 text-[hsl(var(--status-active))]" />
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-sidebar-foreground text-lg">
                Conductor
              </p>
              <p className="text-sm text-sidebar-foreground/50">
                Tracking GPS y gestión de paradas
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-sidebar-foreground/30 text-xs mt-12">
        © {new Date().getFullYear()} RutaViva. Todos los derechos reservados.
      </p>
    </div>
  );
}

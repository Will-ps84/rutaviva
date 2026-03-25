import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { HelpCircle, Menu, Search, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertsBell } from '@/components/AlertsBell';

const routeLabels: Record<string, string[]> = {
  '/app': ['Despacho', 'En Tiempo Real'],
  '/app/routes': ['Rutas', 'Gestión'],
  '/app/drivers': ['Conductores', 'Flota'],
  '/app/reports': ['Reportes', 'Métricas'],
  '/app/settings': ['Configuración', 'Parámetros'],
};

function Breadcrumbs() {
  const location = useLocation();
  const path = location.pathname;

  // Find best matching route
  const matchKey = Object.keys(routeLabels)
    .filter(k => path.startsWith(k))
    .sort((a, b) => b.length - a.length)[0] || '/app';

  const labels = routeLabels[matchKey] || ['Despacho'];

  // Check for route detail
  const isRouteDetail = /^\/app\/routes\/.+$/.test(path);
  const crumbs = isRouteDetail
    ? ['Rutas', 'Detalle']
    : labels;

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Home className="h-4 w-4 text-muted-foreground" />
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className={i === crumbs.length - 1
            ? 'font-medium text-foreground'
            : 'text-muted-foreground'
          }>
            {crumb}
          </span>
        </span>
      ))}
    </div>
  );
}

export function AppLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Modern header */}
          <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Menu className="h-4 w-4" />
              </SidebarTrigger>
              <div className="hidden sm:block">
                <Breadcrumbs />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative hidden md:block">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar rutas, conductores..."
                  className="pl-8 w-56 h-8 text-sm bg-muted/50 border-border/50 focus:bg-card"
                />
              </div>

              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative h-8 w-8">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-destructive rounded-full" />
              </Button>

              {/* Help */}
              <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>
          </header>
          
          {/* Main content */}
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

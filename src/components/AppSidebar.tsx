import { 
  LayoutDashboard, 
  Route, 
  Users, 
  Settings, 
  Truck,
  LogOut,
  ChevronLeft
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const menuItems = [
  {
    title: 'Despacho',
    url: '/app',
    icon: LayoutDashboard,
    description: 'Dashboard en tiempo real',
  },
  {
    title: 'Rutas',
    url: '/app/routes',
    icon: Route,
    description: 'Gestión de rutas',
  },
  {
    title: 'Conductores',
    url: '/app/drivers',
    icon: Users,
    description: 'Flota y personal',
  },
  {
    title: 'Configuración',
    url: '/app/settings',
    icon: Settings,
    description: 'Alertas y parámetros',
  },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <Truck className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold text-sidebar-foreground">
                RutaViva
              </span>
              <span className="text-xs text-sidebar-foreground/50">
                Tracking & Ruteo
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.url || 
              (item.url !== '/app' && location.pathname.startsWith(item.url));
            
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={collapsed ? item.title : undefined}
                >
                  <NavLink
                    to={item.url}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      isActive 
                        ? 'bg-sidebar-accent text-sidebar-primary' 
                        : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && (
                      <div className="flex flex-col">
                        <span className="font-medium">{item.title}</span>
                        <span className="text-xs opacity-60">{item.description}</span>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-4">
        <Separator className="bg-sidebar-border" />
        
        {!collapsed && user && (
          <div className="px-2">
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {user.email}
            </p>
          </div>
        )}

        <Button
          variant="ghost"
          className={cn(
            'w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
            collapsed ? 'justify-center px-0' : 'justify-start'
          )}
          onClick={signOut}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="ml-3">Cerrar sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

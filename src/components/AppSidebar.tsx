import { 
  LayoutDashboard, 
  Route, 
  Users, 
  Settings, 
  Truck,
  LogOut,
  BarChart3,
  ChevronUp,
  User,
  Building2,
  Shield,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserCompany } from '@/hooks/useCompany';
import { useCurrentUserRole } from '@/hooks/useUserRole';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';

const menuItems = [
  {
    title: 'Despacho',
    url: '/app',
    icon: LayoutDashboard,
    roles: ['admin', 'dispatcher', 'owner', 'super_admin'],
  },
  {
    title: 'Rutas',
    url: '/app/routes',
    icon: Route,
    roles: ['admin', 'dispatcher', 'owner', 'super_admin'],
  },
  {
    title: 'Conductores',
    url: '/app/drivers',
    icon: Users,
    roles: ['admin', 'dispatcher', 'owner', 'super_admin'],
  },
  {
    title: 'Reportes',
    url: '/app/reports',
    icon: BarChart3,
    roles: ['admin', 'dispatcher', 'owner', 'super_admin'],
  },
  {
    title: 'Mi Empresa',
    url: '/app/company',
    icon: Building2,
    roles: ['admin', 'owner', 'super_admin'],
  },
  {
    title: 'Super Admin',
    url: '/app/admin',
    icon: Shield,
    roles: ['super_admin'],
  },
  {
    title: 'Configuración',
    url: '/app/settings',
    icon: Settings,
    roles: ['admin', 'owner', 'super_admin'],
  },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { data: company } = useUserCompany();
  const { data: currentRole } = useCurrentUserRole();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const userRole = currentRole?.role || 'viewer';
  const visibleItems = menuItems.filter(item => item.roles.includes(userRole));

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'U';

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-gradient-to-b from-sidebar-background to-[hsl(222,71%,3%)]">
      {/* Logo + Company */}
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[hsl(224,89%,60%)] flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-display text-lg font-bold text-sidebar-foreground tracking-tight">
                RutaViva
              </span>
              <span className="text-[11px] text-sidebar-foreground/40 truncate">
                {company?.name || 'Tracking & Ruteo'}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {!collapsed && (
        <div className="px-4 pb-2">
          <Separator className="bg-sidebar-border/60" />
        </div>
      )}

      {/* Navigation */}
      <SidebarContent className="px-3 py-1">
        <SidebarMenu className="space-y-0.5">
          {visibleItems.map((item) => {
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
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                      isActive 
                        ? 'bg-primary/10 text-sidebar-primary border border-primary/20 shadow-sm shadow-primary/5' 
                        : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 border border-transparent'
                    )}
                  >
                    <item.icon className={cn(
                      "h-[18px] w-[18px] flex-shrink-0 transition-colors",
                      isActive ? "text-sidebar-primary" : ""
                    )} />
                    {!collapsed && (
                      <span className={cn(
                        "text-sm",
                        isActive ? "font-semibold" : "font-medium"
                      )}>
                        {item.title}
                      </span>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* User section */}
      <SidebarFooter className="p-3">
        <Separator className="bg-sidebar-border/60 mb-3" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-3 rounded-lg transition-colors hover:bg-sidebar-accent/60',
                collapsed ? 'justify-center p-2' : 'p-2.5'
              )}
            >
              <Avatar className="h-8 w-8 border border-primary/30 flex-shrink-0">
                <AvatarFallback className="bg-primary/20 text-sidebar-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {user?.email?.split('@')[0] || 'Usuario'}
                    </p>
                    <p className="text-[11px] text-sidebar-foreground/40 truncate">
                      {user?.email}
                    </p>
                  </div>
                  <ChevronUp className="h-4 w-4 text-sidebar-foreground/40 flex-shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuItem className="gap-2">
              <User className="h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" asChild>
              <NavLink to="/app/settings">
                <Settings className="h-4 w-4" />
                Configuración
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

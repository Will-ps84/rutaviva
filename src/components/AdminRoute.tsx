import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

const ADMIN_ROLES = ['admin', 'owner', 'super_admin', 'dispatcher', 'viewer'];

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { data: role, isLoading: roleLoading } = useCurrentUserRole();
  const location = useLocation();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (!role || !ADMIN_ROLES.includes(role.role)) {
    return <Navigate to="/choose-mode" state={{ noPermission: true }} replace />;
  }

  return <>{children}</>;
}

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

export function DriverRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { data: role, isLoading: roleLoading } = useCurrentUserRole();

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
    return <Navigate to="/driver/login" replace />;
  }

  // Drivers can access, but also admins (for testing)
  if (!role) {
    return <Navigate to="/choose-mode" state={{ noPermission: true }} replace />;
  }

  return <>{children}</>;
}

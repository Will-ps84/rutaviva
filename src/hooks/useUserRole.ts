import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'super_admin' | 'admin' | 'dispatcher' | 'driver' | 'viewer' | 'owner';

export interface UserRole {
  id: string;
  user_id: string;
  company_id: string;
  role: AppRole;
  status: string;
  created_at: string;
}

export function useCurrentUserRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['current-user-role', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      return data[0] as UserRole;
    },
    enabled: !!user,
  });
}

export function useIsSuperAdmin() {
  const { data: role } = useCurrentUserRole();
  return role?.role === 'super_admin';
}

export function useIsAdmin() {
  const { data: role } = useCurrentUserRole();
  return role?.role === 'admin' || role?.role === 'owner' || role?.role === 'super_admin';
}

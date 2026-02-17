import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserCompany } from './useCompany';
import { toast } from '@/hooks/use-toast';

export interface CompanyMember {
  id: string; // user_roles.id
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  full_name: string | null;
  phone: string | null;
  email?: string;
}

export function useCompanyMembers() {
  const { data: company } = useUserCompany();

  return useQuery({
    queryKey: ['company-members', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];

      // Get all roles for this company
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: true });

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      // Get profiles for those users
      const userIds = [...new Set(roles.map(r => r.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return roles.map(r => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        status: r.status,
        created_at: r.created_at,
        full_name: profileMap.get(r.user_id)?.full_name || null,
        phone: profileMap.get(r.user_id)?.phone || null,
      })) as CompanyMember[];
    },
    enabled: !!company?.id,
  });
}

export function useUpdateMemberStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roleId, status }: { roleId: string; status: 'active' | 'inactive' }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ status })
        .eq('id', roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-members'] });
      toast({ title: 'Estado actualizado', description: 'El miembro fue actualizado correctamente.' });
    },
    onError: (error) => {
      const msg = error.message || '';
      if (msg.includes('Límite') || msg.includes('cupo') || msg.includes('quota')) {
        toast({
          title: 'Cupo alcanzado',
          description: 'Has alcanzado el límite de tu plan. Desactiva un usuario o aumenta el plan.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      }
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roleId, role }: { roleId: string; role: 'admin' | 'dispatcher' | 'driver' | 'viewer' | 'owner' | 'super_admin' }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('id', roleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-members'] });
      toast({ title: 'Rol actualizado', description: 'El rol fue cambiado correctamente.' });
    },
    onError: (error) => {
      const msg = error.message || '';
      if (msg.includes('Límite') || msg.includes('cupo') || msg.includes('quota')) {
        toast({
          title: 'Cupo alcanzado',
          description: 'Has alcanzado el límite de tu plan para este rol. Desactiva un usuario o aumenta el plan.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      }
    },
  });
}

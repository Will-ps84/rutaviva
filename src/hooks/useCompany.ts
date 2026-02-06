import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface Company {
  id: string;
  name: string;
  created_at: string;
}

export function useUserCompany() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-company', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      // First get the user's profile to get company_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      
      if (!profile.company_id) {
        return null;
      }
      
      // Then get the company details
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();
      
      if (companyError) throw companyError;
      
      return company as Company;
    },
    enabled: !!user,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('Usuario no autenticado');
      
      // Create company (trigger auto-updates profile.company_id)
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({ name })
        .select()
        .single();
      
      if (companyError) throw companyError;
      
      // Create admin role for this user
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          company_id: company.id,
          role: 'admin',
        });
      
      if (roleError) throw roleError;
      
      return company;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-company'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast({
        title: 'Empresa creada',
        description: 'Tu empresa fue creada exitosamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al crear empresa',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUserRoles() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

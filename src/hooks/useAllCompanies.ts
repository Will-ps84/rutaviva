import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface CompanyWithPlan {
  id: string;
  name: string;
  plan_name: string;
  max_admins: number;
  max_drivers: number;
  status: string;
  created_at: string;
}

export function useAllCompanies() {
  return useQuery({
    queryKey: ['all-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CompanyWithPlan[];
    },
  });
}

export function useUpdateCompanyPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      updates,
    }: {
      companyId: string;
      updates: Partial<Pick<CompanyWithPlan, 'plan_name' | 'max_admins' | 'max_drivers' | 'status'>>;
    }) => {
      const { error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-companies'] });
      toast({ title: 'Empresa actualizada', description: 'Los cambios se guardaron correctamente.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

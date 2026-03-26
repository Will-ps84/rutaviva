import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserCompany } from './useCompany';

export interface AuditLog {
  id: string;
  company_id: string | null;
  user_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

// SECURITY: No external companyId param allowed — company is always derived
// from the authenticated user's session via useUserCompany() (server-side RLS enforced).
export function useAuditLogs() {
  const { data: company } = useUserCompany();

  return useQuery({
    queryKey: ['audit-logs', company?.id],
    queryFn: async () => {
      if (!company?.id) throw new Error('No company');

      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as AuditLog[];
    },
    enabled: !!company?.id,
  });
}

export function useAllAuditLogs() {
  return useQuery({
    queryKey: ['all-audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data || []) as AuditLog[];
    },
  });
}

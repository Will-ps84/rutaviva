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

export function useAuditLogs(companyId?: string) {
  const { data: company } = useUserCompany();
  const targetCompanyId = companyId || company?.id;

  return useQuery({
    queryKey: ['audit-logs', targetCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (targetCompanyId) {
        query = query.eq('company_id', targetCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AuditLog[];
    },
    enabled: !!targetCompanyId,
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

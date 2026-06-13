import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserCompany } from './useCompany';
import { toast } from '@/hooks/use-toast';

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  request_count: number;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateRawKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const random = crypto.getRandomValues(new Uint8Array(40));
  return 'rv_live_' + Array.from(random).map(b => chars[b % chars.length]).join('');
}

export function useApiKeys() {
  const { data: company } = useUserCompany();

  return useQuery({
    queryKey: ['api-keys', company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_api_keys')
        .select('id, name, key_prefix, is_active, request_count, last_used_at, created_at, expires_at')
        .eq('company_id', company!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as ApiKey[];
    },
    enabled: !!company?.id,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const { data: company } = useUserCompany();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (!company?.id) throw new Error('No hay empresa activa');

      const rawKey = generateRawKey();
      const keyHash = await sha256Hex(rawKey);
      const keyPrefix = rawKey.slice(0, 12) + '...';

      const { error } = await supabase.from('company_api_keys').insert({
        company_id: company.id,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        is_active: true,
      });

      if (error) throw error;

      // Devolvemos la clave en texto plano UNA SOLA VEZ — no se puede recuperar después
      return { rawKey, keyPrefix };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (err) => {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase
        .from('company_api_keys')
        .update({ is_active: false })
        .eq('id', keyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast({ title: 'API Key revocada', description: 'La clave ya no puede ser usada.' });
    },
    onError: (err) => {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface Driver {
  id: string;
  full_name: string | null;
  phone: string | null;
  company_id: string | null;
  created_at: string;
  // User email from auth (joined)
  email?: string;
}

export interface Vehicle {
  id: string;
  company_id: string;
  plate: string;
  label: string | null;
  created_at: string;
}

export function useDrivers() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      // First get driver user_ids from user_roles (no FK join needed)
      const { data: driverRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'driver');
      
      if (rolesError) throw rolesError;
      
      if (!driverRoles || driverRoles.length === 0) {
        return [] as Driver[];
      }
      
      // Then fetch profiles for those user_ids
      const driverIds = driverRoles.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', driverIds);
      
      if (profilesError) throw profilesError;
      return (profiles || []) as Driver[];
    },
    enabled: !!user,
    retry: 2,
    staleTime: 30000,
  });
}

export function useVehicles() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Vehicle[];
    },
    enabled: !!user,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { plate: string; label: string | null; company_id: string }) => {
      const { data: vehicle, error } = await supabase
        .from('vehicles')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast({
        title: 'Vehículo creado',
        description: 'El vehículo fue agregado correctamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al crear vehículo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Vehicle> & { id: string }) => {
      const { data, error } = await supabase
        .from('vehicles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast({
        title: 'Vehículo actualizado',
        description: 'Los cambios se guardaron correctamente.',
      });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (vehicleId: string) => {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast({
        title: 'Vehículo eliminado',
        description: 'El vehículo fue eliminado correctamente.',
      });
    },
  });
}

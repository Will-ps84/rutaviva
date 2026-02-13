import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserCompany } from './useCompany';

export interface ReportFilters {
  dateFrom: string; // yyyy-MM-dd
  dateTo: string;   // yyyy-MM-dd
  driverId?: string; // 'all' or uuid
  vehicleId?: string; // 'all' or uuid
}

export interface DailySummary {
  activeDrivers: number;
  completedRoutes: number;
  totalDeliveries: number;
  skippedDeliveries: number;
  failedDeliveries: number;
  avgTimePerRouteMin: number;
}

export interface RouteReport {
  id: string;
  name: string;
  date: string;
  status: string;
  driverName: string | null;
  vehiclePlate: string | null;
  vehicleLabel: string | null;
  totalStops: number;
  doneStops: number;
  skippedStops: number;
  failedStops: number;
  pendingStops: number;
  createdAt: string;
  completedAt: string | null;
  durationMin: number | null;
}

export interface DriverReport {
  driverId: string;
  driverName: string | null;
  totalRoutes: number;
  completedRoutes: number;
  totalStops: number;
  doneStops: number;
  skippedStops: number;
  failedStops: number;
  avgDurationMin: number;
}

export interface VehicleReport {
  vehicleId: string;
  plate: string;
  label: string | null;
  totalRoutes: number;
  completedRoutes: number;
  totalStops: number;
  doneStops: number;
}

function applyFilters(
  query: any,
  companyId: string,
  filters: ReportFilters
) {
  let q = query
    .eq('company_id', companyId)
    .gte('date', filters.dateFrom)
    .lte('date', filters.dateTo);

  if (filters.driverId && filters.driverId !== 'all') {
    q = q.eq('driver_id', filters.driverId);
  }
  if (filters.vehicleId && filters.vehicleId !== 'all') {
    q = q.eq('vehicle_id', filters.vehicleId);
  }
  return q;
}

export function useDailySummary(filters: ReportFilters) {
  const { user } = useAuth();
  const { data: company } = useUserCompany();

  return useQuery({
    queryKey: ['report-daily', filters, company?.id],
    queryFn: async () => {
      if (!company?.id) throw new Error('No company');

      const baseQuery = supabase
        .from('routes')
        .select(`
          id, status, created_at, completed_at, driver_id,
          route_stops(id, status)
        `);

      const { data: routes, error } = await applyFilters(baseQuery, company.id, filters);
      if (error) throw error;

      const uniqueDrivers = new Set(routes?.filter((r: any) => r.driver_id).map((r: any) => r.driver_id));
      const completedRoutes = routes?.filter((r: any) => r.status === 'done') || [];

      let totalDone = 0, totalSkipped = 0, totalFailed = 0;
      const durations: number[] = [];

      for (const route of routes || []) {
        const stops = (route as any).route_stops || [];
        totalDone += stops.filter((s: any) => s.status === 'done').length;
        totalSkipped += stops.filter((s: any) => s.status === 'skipped').length;
        totalFailed += stops.filter((s: any) => s.status === 'failed').length;

        if ((route as any).completed_at && (route as any).created_at) {
          const dur = (new Date((route as any).completed_at).getTime() - new Date((route as any).created_at).getTime()) / 60000;
          if (dur > 0 && dur < 1440) durations.push(dur);
        }
      }

      const summary: DailySummary = {
        activeDrivers: uniqueDrivers.size,
        completedRoutes: completedRoutes.length,
        totalDeliveries: totalDone,
        skippedDeliveries: totalSkipped,
        failedDeliveries: totalFailed,
        avgTimePerRouteMin: durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0,
      };

      return summary;
    },
    enabled: !!user && !!company?.id,
  });
}

export function useRouteReports(filters: ReportFilters) {
  const { user } = useAuth();
  const { data: company } = useUserCompany();

  return useQuery({
    queryKey: ['report-routes', filters, company?.id],
    queryFn: async () => {
      if (!company?.id) throw new Error('No company');

      const baseQuery = supabase
        .from('routes')
        .select(`
          id, name, date, status, created_at, completed_at, driver_id, vehicle_id,
          driver:profiles!routes_driver_id_fkey(full_name),
          vehicle:vehicles(plate, label),
          route_stops(id, status)
        `)
        .order('date', { ascending: false });

      const { data, error } = await applyFilters(baseQuery, company.id, filters);
      if (error) throw error;

      return (data || []).map((r: any): RouteReport => {
        const stops = r.route_stops || [];
        const durationMin = r.completed_at && r.created_at
          ? Math.round((new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()) / 60000)
          : null;

        return {
          id: r.id,
          name: r.name,
          date: r.date,
          status: r.status,
          driverName: r.driver?.full_name || null,
          vehiclePlate: r.vehicle?.plate || null,
          vehicleLabel: r.vehicle?.label || null,
          totalStops: stops.length,
          doneStops: stops.filter((s: any) => s.status === 'done').length,
          skippedStops: stops.filter((s: any) => s.status === 'skipped').length,
          failedStops: stops.filter((s: any) => s.status === 'failed').length,
          pendingStops: stops.filter((s: any) => s.status === 'pending').length,
          createdAt: r.created_at,
          completedAt: r.completed_at,
          durationMin,
        };
      });
    },
    enabled: !!user && !!company?.id,
  });
}

export function useDriverReports(filters: ReportFilters) {
  const { user } = useAuth();
  const { data: company } = useUserCompany();

  return useQuery({
    queryKey: ['report-drivers', filters, company?.id],
    queryFn: async () => {
      if (!company?.id) throw new Error('No company');

      const baseQuery = supabase
        .from('routes')
        .select(`
          id, status, created_at, completed_at, driver_id,
          driver:profiles!routes_driver_id_fkey(id, full_name),
          route_stops(id, status)
        `)
        .not('driver_id', 'is', null);

      const { data, error } = await applyFilters(baseQuery, company.id, filters);
      if (error) throw error;

      const driverMap = new Map<string, DriverReport>();
      const durationSums = new Map<string, { total: number; count: number }>();

      for (const r of data || []) {
        const dId = (r as any).driver_id!;
        const existing = driverMap.get(dId) || {
          driverId: dId,
          driverName: (r as any).driver?.full_name || null,
          totalRoutes: 0,
          completedRoutes: 0,
          totalStops: 0,
          doneStops: 0,
          skippedStops: 0,
          failedStops: 0,
          avgDurationMin: 0,
        };

        existing.totalRoutes++;
        if ((r as any).status === 'done') existing.completedRoutes++;

        const stops = (r as any).route_stops || [];
        existing.totalStops += stops.length;
        existing.doneStops += stops.filter((s: any) => s.status === 'done').length;
        existing.skippedStops += stops.filter((s: any) => s.status === 'skipped').length;
        existing.failedStops += stops.filter((s: any) => s.status === 'failed').length;

        driverMap.set(dId, existing);

        if ((r as any).completed_at && (r as any).created_at) {
          const dur = (new Date((r as any).completed_at).getTime() - new Date((r as any).created_at).getTime()) / 60000;
          if (dur > 0 && dur < 1440) {
            const prev = durationSums.get(dId) || { total: 0, count: 0 };
            durationSums.set(dId, { total: prev.total + dur, count: prev.count + 1 });
          }
        }
      }

      for (const [dId, sums] of durationSums) {
        const d = driverMap.get(dId);
        if (d && sums.count > 0) {
          d.avgDurationMin = Math.round(sums.total / sums.count);
        }
      }

      return Array.from(driverMap.values());
    },
    enabled: !!user && !!company?.id,
  });
}

export function useVehicleReports(filters: ReportFilters) {
  const { user } = useAuth();
  const { data: company } = useUserCompany();

  return useQuery({
    queryKey: ['report-vehicles', filters, company?.id],
    queryFn: async () => {
      if (!company?.id) throw new Error('No company');

      const baseQuery = supabase
        .from('routes')
        .select(`
          id, status, vehicle_id,
          vehicle:vehicles(id, plate, label),
          route_stops(id, status)
        `)
        .not('vehicle_id', 'is', null);

      const { data, error } = await applyFilters(baseQuery, company.id, filters);
      if (error) throw error;

      const vehicleMap = new Map<string, VehicleReport>();

      for (const r of data || []) {
        const v = (r as any).vehicle;
        if (!v) continue;
        const vId = v.id;

        const existing = vehicleMap.get(vId) || {
          vehicleId: vId,
          plate: v.plate,
          label: v.label,
          totalRoutes: 0,
          completedRoutes: 0,
          totalStops: 0,
          doneStops: 0,
        };

        existing.totalRoutes++;
        if ((r as any).status === 'done') existing.completedRoutes++;

        const stops = (r as any).route_stops || [];
        existing.totalStops += stops.length;
        existing.doneStops += stops.filter((s: any) => s.status === 'done').length;

        vehicleMap.set(vId, existing);
      }

      return Array.from(vehicleMap.values());
    },
    enabled: !!user && !!company?.id,
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserCompany } from './useCompany';
import type { ReportFilters } from './useReportsData';

export interface DashboardKPIs {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  completionPct: number;
  totalWeightKg: number;
  deliveredWeightKg: number;
  pendingWeightKg: number;
  avgFleetOccupancy: number;
  activeVehicles: number;
  estimatedCost: number;
  costPerDelivery: number;
}

export interface VehicleOccupancy {
  vehicleId: string;
  plate: string;
  label: string | null;
  driverName: string | null;
  assignedOrders: number;
  loadedKg: number;
  capacityKg: number | null;
  occupancyPct: number;
  routeStatus: string;
}

export interface ZoneData {
  zone: string;
  total: number;
  completed: number;
  pending: number;
  weightKg: number;
  pctOfTotal: number;
}

export interface StopDetail {
  id: string;
  routeName: string;
  address: string;
  recipientName: string | null;
  zone: string | null;
  weightKg: number | null;
  status: string;
  completedAt: string | null;
}

const ZONES = ['Lima Norte', 'Lima Sur', 'Lima Este', 'Lima Moderna', 'Callao', 'Provincias'];

export function useDashboardOperativo(filters: ReportFilters) {
  const { user } = useAuth();
  const { data: company } = useUserCompany();

  return useQuery({
    queryKey: ['dashboard-operativo', filters, company?.id],
    queryFn: async () => {
      if (!company?.id) throw new Error('No company');

      // Fetch routes with stops, vehicles, drivers
      let query = supabase
        .from('routes')
        .select(`
          id, name, date, status, driver_id, vehicle_id, cost_per_km, distance_km, completed_at,
          driver:profiles!routes_driver_id_fkey(full_name),
          vehicle:vehicles(id, plate, label, capacity),
          route_stops(id, address_text, recipient_name, zone, weight_kg, status, completed_at)
        `)
        .eq('company_id', company.id)
        .gte('date', filters.dateFrom)
        .lte('date', filters.dateTo);

      if (filters.driverId && filters.driverId !== 'all') {
        query = query.eq('driver_id', filters.driverId);
      }
      if (filters.vehicleId && filters.vehicleId !== 'all') {
        query = query.eq('vehicle_id', filters.vehicleId);
      }

      const { data: routes, error } = await query;
      if (error) throw error;

      // Filter by zone if needed (client-side since zone is on stops)
      const zoneFilter = filters.zone && filters.zone !== 'all' ? filters.zone : null;

      let allStops: StopDetail[] = [];
      let totalWeight = 0, deliveredWeight = 0;
      let totalCost = 0;
      const vehicleMap = new Map<string, VehicleOccupancy>();
      const zoneMap = new Map<string, { total: number; completed: number; pending: number; weightKg: number }>();

      // Initialize zones
      ZONES.forEach(z => zoneMap.set(z, { total: 0, completed: 0, pending: 0, weightKg: 0 }));
      zoneMap.set('Sin zona', { total: 0, completed: 0, pending: 0, weightKg: 0 });

      for (const route of routes || []) {
        const r = route as any;
        const stops = r.route_stops || [];
        const routeCost = (r.distance_km ?? 0) * (r.cost_per_km ?? 0);
        totalCost += routeCost;

        // Vehicle occupancy
        if (r.vehicle) {
          const vId = r.vehicle.id;
          const existing = vehicleMap.get(vId) || {
            vehicleId: vId,
            plate: r.vehicle.plate,
            label: r.vehicle.label,
            driverName: r.driver?.full_name || null,
            assignedOrders: 0,
            loadedKg: 0,
            capacityKg: r.vehicle.capacity,
            occupancyPct: 0,
            routeStatus: r.status,
          };
          
          for (const s of stops) {
            if (!zoneFilter || s.zone === zoneFilter) {
              existing.assignedOrders++;
              existing.loadedKg += s.weight_kg ?? 0;
            }
          }

          // Update status priority: in_progress > published > done > draft
          const statusPriority: Record<string, number> = { in_progress: 3, published: 2, done: 1, draft: 0 };
          if ((statusPriority[r.status] ?? 0) > (statusPriority[existing.routeStatus] ?? 0)) {
            existing.routeStatus = r.status;
          }

          if (existing.capacityKg && existing.capacityKg > 0) {
            existing.occupancyPct = Math.round((existing.loadedKg / existing.capacityKg) * 100);
          }
          vehicleMap.set(vId, existing);
        }

        for (const s of stops) {
          if (zoneFilter && s.zone !== zoneFilter) continue;

          const w = s.weight_kg ?? 0;
          totalWeight += w;
          const isDone = s.status === 'done';
          if (isDone) deliveredWeight += w;

          // Zone aggregation
          const zKey = s.zone && ZONES.includes(s.zone) ? s.zone : 'Sin zona';
          const zd = zoneMap.get(zKey)!;
          zd.total++;
          zd.weightKg += w;
          if (isDone) zd.completed++;
          else zd.pending++;

          allStops.push({
            id: s.id,
            routeName: r.name,
            address: s.address_text,
            recipientName: s.recipient_name,
            zone: s.zone,
            weightKg: s.weight_kg,
            status: s.status,
            completedAt: s.completed_at,
          });
        }
      }

      const totalOrders = allStops.length;
      const completedOrders = allStops.filter(s => s.status === 'done').length;
      const pendingOrders = totalOrders - completedOrders;
      const completionPct = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

      // Fleet occupancy avg
      const vehiclesArr = Array.from(vehicleMap.values());
      const vehiclesWithCapacity = vehiclesArr.filter(v => v.capacityKg && v.capacityKg > 0);
      const avgFleetOccupancy = vehiclesWithCapacity.length > 0
        ? Math.round(vehiclesWithCapacity.reduce((s, v) => s + v.occupancyPct, 0) / vehiclesWithCapacity.length)
        : 0;

      const costPerDelivery = completedOrders > 0 ? Math.round((totalCost / completedOrders) * 100) / 100 : 0;

      // Zone data
      const totalForPct = totalOrders || 1;
      const zoneData: ZoneData[] = Array.from(zoneMap.entries())
        .map(([zone, d]) => ({
          zone,
          ...d,
          pctOfTotal: Math.round((d.total / totalForPct) * 100),
        }))
        .filter(z => z.total > 0)
        .sort((a, b) => b.total - a.total);

      const kpis: DashboardKPIs = {
        totalOrders,
        completedOrders,
        pendingOrders,
        completionPct,
        totalWeightKg: Math.round(totalWeight * 100) / 100,
        deliveredWeightKg: Math.round(deliveredWeight * 100) / 100,
        pendingWeightKg: Math.round((totalWeight - deliveredWeight) * 100) / 100,
        avgFleetOccupancy,
        activeVehicles: vehiclesArr.length,
        estimatedCost: Math.round(totalCost * 100) / 100,
        costPerDelivery,
      };

      return { kpis, vehicles: vehiclesArr, zones: zoneData, stops: allStops };
    },
    enabled: !!user && !!company?.id,
  });
}

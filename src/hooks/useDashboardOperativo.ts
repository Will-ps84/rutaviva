import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format, eachDayOfInterval, parseISO } from 'date-fns';
import { useAuth } from './useAuth';
import { useUserCompany } from './useCompany';
import type { ReportFilters } from './useReportsData';

export interface DashboardKPIs {
  totalOrders: number;
  completedOrders: number;
  failedOrders: number;
  skippedOrders: number;
  pendingOrders: number;
  completionPct: number;
  failureRate: number;
  totalWeightKg: number;
  deliveredWeightKg: number;
  pendingWeightKg: number;
  avgFleetOccupancy: number;
  activeVehicles: number;
  estimatedCost: number;
  costPerDelivery: number;
  // Comparación con período anterior
  prevCompletionPct: number | null;
  prevTotalOrders: number | null;
  prevFailureRate: number | null;
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
  failed: number;
  pending: number;
  weightKg: number;
  pctOfTotal: number;
  failureRate: number;
}

export interface DailyTrend {
  date: string;       // "dd/MM"
  completados: number;
  fallidos: number;
  total: number;
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

async function fetchRoutesData(companyId: string, dateFrom: string, dateTo: string, filters: ReportFilters) {
  let query = supabase
    .from('routes')
    .select(`
      id, name, date, status, driver_id, vehicle_id, cost_per_km, distance_km, completed_at,
      driver:profiles!routes_driver_id_fkey(full_name),
      vehicle:vehicles(id, plate, label, capacity),
      route_stops(id, address_text, recipient_name, zone, weight_kg, status, completed_at)
    `)
    .eq('company_id', companyId)
    .gte('date', dateFrom)
    .lte('date', dateTo);

  if (filters.driverId && filters.driverId !== 'all') query = query.eq('driver_id', filters.driverId);
  if (filters.vehicleId && filters.vehicleId !== 'all') query = query.eq('vehicle_id', filters.vehicleId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any[];
}

function aggregateRoutes(routes: any[], zoneFilter: string | null) {
  let totalWeight = 0, deliveredWeight = 0, totalCost = 0;
  const vehicleMap = new Map<string, VehicleOccupancy>();
  const zoneMap = new Map<string, { total: number; completed: number; failed: number; pending: number; weightKg: number }>();
  const dailyMap = new Map<string, { completados: number; fallidos: number; total: number }>();
  const allStops: StopDetail[] = [];

  ZONES.forEach(z => zoneMap.set(z, { total: 0, completed: 0, failed: 0, pending: 0, weightKg: 0 }));
  zoneMap.set('Sin zona', { total: 0, completed: 0, failed: 0, pending: 0, weightKg: 0 });

  for (const r of routes) {
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
      const isFailed = s.status === 'failed';
      if (isDone) deliveredWeight += w;

      // Zone aggregation
      const zKey = s.zone && ZONES.includes(s.zone) ? s.zone : 'Sin zona';
      const zd = zoneMap.get(zKey)!;
      zd.total++;
      zd.weightKg += w;
      if (isDone) zd.completed++;
      else if (isFailed) { zd.failed++; zd.pending++; }
      else zd.pending++;

      // Daily trend (use route date or completed_at)
      const dayKey = r.date as string;
      if (dayKey) {
        const day = dailyMap.get(dayKey) ?? { completados: 0, fallidos: 0, total: 0 };
        day.total++;
        if (isDone) day.completados++;
        if (isFailed) day.fallidos++;
        dailyMap.set(dayKey, day);
      }

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

  return { allStops, totalWeight, deliveredWeight, totalCost, vehicleMap, zoneMap, dailyMap };
}

export function useDashboardOperativo(filters: ReportFilters) {
  const { user } = useAuth();
  const { data: company } = useUserCompany();

  return useQuery({
    queryKey: ['dashboard-operativo', filters, company?.id],
    queryFn: async () => {
      if (!company?.id) throw new Error('No company');

      const zoneFilter = filters.zone && filters.zone !== 'all' ? filters.zone : null;

      // Período actual
      const routes = await fetchRoutesData(company.id, filters.dateFrom, filters.dateTo, filters);
      const agg = aggregateRoutes(routes, zoneFilter);

      // Período anterior (misma duración, desplazado hacia atrás)
      const from = parseISO(filters.dateFrom);
      const to = parseISO(filters.dateTo);
      const periodDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const prevFrom = format(subDays(from, periodDays), 'yyyy-MM-dd');
      const prevTo = format(subDays(from, 1), 'yyyy-MM-dd');

      let prevKpis: { totalOrders: number; completionPct: number; failureRate: number } | null = null;
      try {
        const prevRoutes = await fetchRoutesData(company.id, prevFrom, prevTo, filters);
        const prevAgg = aggregateRoutes(prevRoutes, zoneFilter);
        const prevTotal = prevAgg.allStops.length;
        const prevCompleted = prevAgg.allStops.filter(s => s.status === 'done').length;
        const prevFailed = prevAgg.allStops.filter(s => s.status === 'failed').length;
        prevKpis = {
          totalOrders: prevTotal,
          completionPct: prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0,
          failureRate: prevTotal > 0 ? Math.round((prevFailed / prevTotal) * 100) : 0,
        };
      } catch {
        // período anterior no disponible, no es crítico
      }

      const { allStops, totalWeight, deliveredWeight, totalCost, vehicleMap, zoneMap, dailyMap } = agg;

      const totalOrders = allStops.length;
      const completedOrders = allStops.filter(s => s.status === 'done').length;
      const failedOrders = allStops.filter(s => s.status === 'failed').length;
      const skippedOrders = allStops.filter(s => s.status === 'skipped').length;
      const pendingOrders = allStops.filter(s => !['done', 'failed', 'skipped'].includes(s.status)).length;
      const completionPct = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
      const failureRate = totalOrders > 0 ? Math.round((failedOrders / totalOrders) * 100) : 0;

      const vehiclesArr = Array.from(vehicleMap.values());
      const vehiclesWithCapacity = vehiclesArr.filter(v => v.capacityKg && v.capacityKg > 0);
      const avgFleetOccupancy = vehiclesWithCapacity.length > 0
        ? Math.round(vehiclesWithCapacity.reduce((s, v) => s + v.occupancyPct, 0) / vehiclesWithCapacity.length)
        : 0;

      const costPerDelivery = completedOrders > 0 ? Math.round((totalCost / completedOrders) * 100) / 100 : 0;

      const totalForPct = totalOrders || 1;
      const zoneData: ZoneData[] = Array.from(zoneMap.entries())
        .map(([zone, d]) => ({
          zone,
          ...d,
          pctOfTotal: Math.round((d.total / totalForPct) * 100),
          failureRate: d.total > 0 ? Math.round((d.failed / d.total) * 100) : 0,
        }))
        .filter(z => z.total > 0)
        .sort((a, b) => b.total - a.total);

      // Tendencia diaria — rellenar días sin datos con 0
      const allDays = eachDayOfInterval({ start: from, end: to });
      const dailyTrend: DailyTrend[] = allDays.map(d => {
        const key = format(d, 'yyyy-MM-dd');
        const entry = dailyMap.get(key) ?? { completados: 0, fallidos: 0, total: 0 };
        return { date: format(d, 'dd/MM'), ...entry };
      });

      const kpis: DashboardKPIs = {
        totalOrders,
        completedOrders,
        failedOrders,
        skippedOrders,
        pendingOrders,
        completionPct,
        failureRate,
        totalWeightKg: Math.round(totalWeight * 100) / 100,
        deliveredWeightKg: Math.round(deliveredWeight * 100) / 100,
        pendingWeightKg: Math.round((totalWeight - deliveredWeight) * 100) / 100,
        avgFleetOccupancy,
        activeVehicles: vehiclesArr.length,
        estimatedCost: Math.round(totalCost * 100) / 100,
        costPerDelivery,
        prevCompletionPct: prevKpis?.completionPct ?? null,
        prevTotalOrders: prevKpis?.totalOrders ?? null,
        prevFailureRate: prevKpis?.failureRate ?? null,
      };

      return { kpis, vehicles: vehiclesArr, zones: zoneData, stops: allStops, dailyTrend };
    },
    enabled: !!user && !!company?.id,
  });
}

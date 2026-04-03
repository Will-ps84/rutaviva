import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Package, Weight, Truck, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import type { ReportFilters } from '@/hooks/useReportsData';
import { useDashboardOperativo } from '@/hooks/useDashboardOperativo';
import { exportDashboardExcel } from '@/lib/exportDashboardExcel';

interface Props {
  filters: ReportFilters;
  companyName?: string;
}

function completionColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 50) return 'text-amber-500';
  return 'text-red-500';
}

function occupancyBadge(pct: number) {
  if (pct > 85) return <Badge className="bg-red-100 text-red-700 text-[10px]">⚠️ Casi lleno</Badge>;
  if (pct >= 60) return <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">✅ Óptimo</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 text-[10px]">📉 Subutilizado</Badge>;
}

function formatWeight(kg: number) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${kg} kg`;
}

const routeStatusLabels: Record<string, string> = {
  in_progress: 'EN RUTA',
  done: 'COMPLETADO',
  draft: 'DISPONIBLE',
  published: 'DISPONIBLE',
};

export default function DashboardOperativo({ filters, companyName }: Props) {
  const { data, isLoading } = useDashboardOperativo(filters);
  const period = `${filters.dateFrom}_${filters.dateTo}`;

  const handleExport = () => {
    if (!data) return;
    exportDashboardExcel(data.kpis, data.vehicles, data.zones, data.stops, period, companyName);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground text-sm">Sin datos para el rango seleccionado.</p>;
  }

  const { kpis, vehicles, zones } = data;

  return (
    <div className="space-y-6">
      {/* Export button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1.5" /> Exportar Excel
        </Button>
      </div>

      {/* Section A: KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Pedidos */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Package className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Pedidos</p>
                <p className={`text-2xl font-bold ${completionColor(kpis.completionPct)}`}>{kpis.totalOrders}</p>
                <p className="text-xs text-muted-foreground">{kpis.completedOrders} completados / {kpis.pendingOrders} pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total KG */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Weight className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total KG a Distribuir</p>
                <p className="text-2xl font-bold text-foreground">{kpis.totalWeightKg > 0 ? formatWeight(kpis.totalWeightKg) : '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {kpis.totalWeightKg > 0
                    ? `${formatWeight(kpis.deliveredWeightKg)} entregados / ${formatWeight(kpis.pendingWeightKg)} pendientes`
                    : 'Sin datos de peso'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completados % */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Package className="h-5 w-5 text-primary" /></div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">% Completados</p>
                <p className={`text-2xl font-bold ${completionColor(kpis.completionPct)}`}>{kpis.completionPct}%</p>
                <Progress value={kpis.completionPct} className="h-2 mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ocupación Flota */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Truck className="h-5 w-5 text-primary" /></div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Ocupación Promedio Flota</p>
                <p className="text-2xl font-bold text-foreground">{kpis.avgFleetOccupancy > 0 ? `${kpis.avgFleetOccupancy}%` : '—'}</p>
                {kpis.avgFleetOccupancy > 0 && <Progress value={kpis.avgFleetOccupancy} className="h-2 mt-1" />}
                <p className="text-xs text-muted-foreground">{kpis.activeVehicles} vehículos activos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Costo Estimado */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Costo Estimado</p>
                <p className="text-2xl font-bold text-foreground">{kpis.estimatedCost > 0 ? `S/. ${kpis.estimatedCost.toFixed(2)}` : '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {kpis.costPerDelivery > 0 ? `Costo por entrega: S/. ${kpis.costPerDelivery.toFixed(2)}` : 'Sin datos de costo'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Peso Entregado */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Weight className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Peso Entregado</p>
                <p className="text-2xl font-bold text-foreground">{kpis.deliveredWeightKg > 0 ? formatWeight(kpis.deliveredWeightKg) : '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {kpis.totalWeightKg > 0
                    ? `${Math.round((kpis.deliveredWeightKg / kpis.totalWeightKg) * 100)}% del total`
                    : 'Sin datos de peso'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section B: Vehicle Occupancy Table */}
      {vehicles.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Truck className="h-4 w-4" /> Ocupación por Vehículo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Conductor</TableHead>
                  <TableHead className="text-center">Pedidos</TableHead>
                  <TableHead className="text-center">KG</TableHead>
                  <TableHead className="text-center">Capacidad</TableHead>
                  <TableHead>% Ocupación</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map(v => (
                  <TableRow key={v.vehicleId}>
                    <TableCell className="font-medium">{v.plate}</TableCell>
                    <TableCell>{v.driverName || '—'}</TableCell>
                    <TableCell className="text-center">{v.assignedOrders}</TableCell>
                    <TableCell className="text-center">{v.loadedKg > 0 ? v.loadedKg.toFixed(1) : '—'}</TableCell>
                    <TableCell className="text-center">{v.capacityKg ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={Math.min(v.occupancyPct, 100)} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-8">{v.occupancyPct}%</span>
                      </div>
                      {v.capacityKg && v.capacityKg > 0 && occupancyBadge(v.occupancyPct)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={v.routeStatus === 'in_progress' ? 'default' : 'secondary'} className="text-xs">
                        {routeStatusLabels[v.routeStatus] || v.routeStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Section C: Zone Distribution Chart */}
      {zones.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Distribución por Zona</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(zones.length * 50, 200)}>
              <BarChart data={zones} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="zone" width={100} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [value, name === 'completed' ? 'Completados' : 'Pendientes']}
                />
                <Legend formatter={(value) => value === 'completed' ? 'Completados' : 'Pendientes'} />
                <Bar dataKey="completed" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pending" stackId="a" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Zone table */}
            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Zona</TableHead>
                  <TableHead className="text-center">Pedidos</TableHead>
                  <TableHead className="text-center">KG</TableHead>
                  <TableHead className="text-center">% del Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map(z => (
                  <TableRow key={z.zone}>
                    <TableCell className="font-medium">{z.zone}</TableCell>
                    <TableCell className="text-center">{z.total}</TableCell>
                    <TableCell className="text-center">{z.weightKg > 0 ? z.weightKg.toFixed(1) : '—'}</TableCell>
                    <TableCell className="text-center">{z.pctOfTotal}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

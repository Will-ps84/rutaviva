import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Download, Package, Weight, Truck, DollarSign,
  TrendingUp, TrendingDown, Minus, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts';
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

function failureColor(pct: number) {
  if (pct === 0) return 'text-emerald-600';
  if (pct <= 10) return 'text-amber-500';
  return 'text-red-500';
}

function occupancyBadge(pct: number) {
  if (pct > 85) return <Badge className="bg-destructive/10 text-destructive text-[10px]">⚠️ Casi lleno</Badge>;
  if (pct >= 60) return <Badge className="bg-primary/10 text-primary text-[10px]">✅ Óptimo</Badge>;
  return <Badge className="bg-accent text-accent-foreground text-[10px]">📉 Subutilizado</Badge>;
}

function formatWeight(kg: number) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${kg} kg`;
}

function DeltaBadge({ current, prev, invert = false }: { current: number; prev: number | null; invert?: boolean }) {
  if (prev === null) return null;
  const delta = current - prev;
  if (Math.abs(delta) < 1) return <span className="text-xs text-muted-foreground">= igual</span>;

  // invert=true: subir es malo (ej: tasa de fallo)
  const isPositive = invert ? delta < 0 : delta > 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {delta > 0 ? '+' : ''}{delta.toFixed(0)}pp vs período anterior
    </span>
  );
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
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

  const { kpis, vehicles, zones, dailyTrend } = data;
  const hasTrend = dailyTrend.some(d => d.total > 0);

  return (
    <div className="space-y-6">
      {/* Export button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1.5" /> Exportar Excel
        </Button>
      </div>

      {/* ── Sección A: KPIs principales ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pedidos */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Package className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Pedidos</p>
                <p className="text-2xl font-bold">{kpis.totalOrders}</p>
                <p className="text-xs text-muted-foreground">{kpis.completedOrders} ✅ · {kpis.failedOrders} ❌ · {kpis.skippedOrders} ⏭️</p>
                {kpis.prevTotalOrders !== null && (
                  <span className="text-xs text-muted-foreground">Anterior: {kpis.prevTotalOrders}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* % Completados */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Tasa de Éxito</p>
                <p className={`text-2xl font-bold ${completionColor(kpis.completionPct)}`}>{kpis.completionPct}%</p>
                <Progress value={kpis.completionPct} className="h-1.5 mt-1" />
                <DeltaBadge current={kpis.completionPct} prev={kpis.prevCompletionPct} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasa de Fallo */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-500/10 shrink-0"><AlertTriangle className="h-5 w-5 text-red-500" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Tasa de Fallo</p>
                <p className={`text-2xl font-bold ${failureColor(kpis.failureRate)}`}>{kpis.failureRate}%</p>
                <p className="text-xs text-muted-foreground">{kpis.failedOrders} entregas fallidas</p>
                <DeltaBadge current={kpis.failureRate} prev={kpis.prevFailureRate} invert />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Costo por Entrega */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Costo / Entrega</p>
                <p className="text-2xl font-bold">
                  {kpis.costPerDelivery > 0 ? `S/. ${kpis.costPerDelivery.toFixed(2)}` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total: {kpis.estimatedCost > 0 ? `S/. ${kpis.estimatedCost.toFixed(2)}` : 'sin datos'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KG Total */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Weight className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total KG a Distribuir</p>
                <p className="text-2xl font-bold">{kpis.totalWeightKg > 0 ? formatWeight(kpis.totalWeightKg) : '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {kpis.totalWeightKg > 0
                    ? `${formatWeight(kpis.deliveredWeightKg)} entregados`
                    : 'Sin datos de peso'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Peso Entregado */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Weight className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Peso Entregado</p>
                <p className="text-2xl font-bold">{kpis.deliveredWeightKg > 0 ? formatWeight(kpis.deliveredWeightKg) : '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {kpis.totalWeightKg > 0
                    ? `${Math.round((kpis.deliveredWeightKg / kpis.totalWeightKg) * 100)}% del total`
                    : 'Sin datos de peso'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ocupación Flota */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Truck className="h-5 w-5 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Ocupación Promedio Flota</p>
                <p className="text-2xl font-bold">{kpis.avgFleetOccupancy > 0 ? `${kpis.avgFleetOccupancy}%` : '—'}</p>
                {kpis.avgFleetOccupancy > 0 && <Progress value={kpis.avgFleetOccupancy} className="h-1.5 mt-1" />}
                <p className="text-xs text-muted-foreground">{kpis.activeVehicles} vehículos activos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pendientes */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 shrink-0"><Minus className="h-5 w-5 text-amber-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-amber-500">{kpis.pendingOrders}</p>
                <p className="text-xs text-muted-foreground">
                  {kpis.totalOrders > 0
                    ? `${Math.round((kpis.pendingOrders / kpis.totalOrders) * 100)}% del total`
                    : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Sección B: Tendencia Diaria ── */}
      {hasTrend && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Tendencia Diaria del Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyTrend} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend formatter={(v) => v === 'completados' ? 'Completados' : v === 'fallidos' ? 'Fallidos' : 'Total'} />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--muted-foreground))" strokeWidth={1} dot={false} />
                <Line type="monotone" dataKey="completados" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="fallidos" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Sección C: Vehículos ── */}
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

      {/* ── Sección D: Zonas con tasa de fallo ── */}
      {zones.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Distribución y Tasa de Fallo por Zona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResponsiveContainer width="100%" height={Math.max(zones.length * 50, 200)}>
              <BarChart data={zones} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="zone" width={100} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'completed' ? 'Completados' : name === 'failed' ? 'Fallidos' : 'Pendientes',
                  ]}
                />
                <Legend formatter={(v) => v === 'completed' ? 'Completados' : v === 'failed' ? 'Fallidos' : 'Pendientes'} />
                <Bar dataKey="completed" stackId="a" fill="hsl(142, 76%, 36%)" />
                <Bar dataKey="failed" stackId="a" fill="hsl(var(--destructive))" />
                <Bar dataKey="pending" stackId="a" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zona</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Completados</TableHead>
                  <TableHead className="text-center">Fallidos</TableHead>
                  <TableHead className="text-center">Tasa Fallo</TableHead>
                  <TableHead className="text-center">KG</TableHead>
                  <TableHead className="text-center">% del Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map(z => (
                  <TableRow key={z.zone}>
                    <TableCell className="font-medium">{z.zone}</TableCell>
                    <TableCell className="text-center">{z.total}</TableCell>
                    <TableCell className="text-center text-emerald-600">{z.completed}</TableCell>
                    <TableCell className="text-center text-red-500">{z.failed}</TableCell>
                    <TableCell className="text-center">
                      <span className={failureColor(z.failureRate)}>{z.failureRate}%</span>
                    </TableCell>
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

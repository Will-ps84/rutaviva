import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  CalendarDays,
  CalendarIcon,
  Users,
  Route,
  Truck,
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  Filter,
  MapPin,
  BarChart3,
} from 'lucide-react';
import {
  useDailySummary,
  useRouteReports,
  useDriverReports,
  useVehicleReports,
  type ReportFilters,
} from '@/hooks/useReportsData';
import { useDrivers, useVehicles } from '@/hooks/useDrivers';
import { exportToExcelJS } from '@/lib/exportExcelJS';
import { exportToPDF } from '@/lib/exportPDF';
import { exportToCsv } from '@/lib/exportCsv';
import { useTrackingData } from '@/hooks/useTrackingExport';
import { useUserCompany } from '@/hooks/useCompany';
import DashboardOperativo from '@/components/reports/DashboardOperativo';

const ZONE_OPTIONS = ['Lima Norte', 'Lima Sur', 'Lima Este', 'Lima Moderna', 'Callao', 'Provincias'];

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  in_progress: 'En curso',
  done: 'Completada',
};

export default function Reports() {
  const today = new Date();
  const [dateFrom, setDateFrom] = useState<Date>(today);
  const [dateTo, setDateTo] = useState<Date>(today);
  const [driverId, setDriverId] = useState('all');
  const [vehicleId, setVehicleId] = useState('all');
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [zone, setZone] = useState('all');

  const { data: drivers } = useDrivers();
  const { data: vehicles } = useVehicles();
  const { data: company } = useUserCompany();

  const filters: ReportFilters = useMemo(() => ({
    dateFrom: format(dateFrom, 'yyyy-MM-dd'),
    dateTo: format(dateTo, 'yyyy-MM-dd'),
    driverId,
    vehicleId,
    zone,
  }), [dateFrom, dateTo, driverId, vehicleId, zone]);

  const { data: summary, isLoading: loadingSummary } = useDailySummary(filters);
  const { data: routeReports, isLoading: loadingRoutes } = useRouteReports(filters);
  const { data: driverReports, isLoading: loadingDrivers } = useDriverReports(filters);
  const { data: vehicleReports, isLoading: loadingVehicles } = useVehicleReports(filters);
  const { data: trackingData, isLoading: loadingTracking } = useTrackingData(
    { dateFrom: filters.dateFrom, dateTo: filters.dateTo, driverId: filters.driverId },
    trackingEnabled
  );

  const setQuickRange = (range: string) => {
    const now = new Date();
    switch (range) {
      case 'today':
        setDateFrom(now);
        setDateTo(now);
        break;
      case 'yesterday': {
        const y = subDays(now, 1);
        setDateFrom(y);
        setDateTo(y);
        break;
      }
      case 'week':
        setDateFrom(startOfWeek(now, { weekStartsOn: 1 }));
        setDateTo(endOfWeek(now, { weekStartsOn: 1 }));
        break;
      case 'month':
        setDateFrom(startOfMonth(now));
        setDateTo(endOfMonth(now));
        break;
      case 'last7':
        setDateFrom(subDays(now, 6));
        setDateTo(now);
        break;
      case 'last30':
        setDateFrom(subDays(now, 29));
        setDateTo(now);
        break;
    }
  };

  const handleReset = () => {
    setDateFrom(today);
    setDateTo(today);
    setDriverId('all');
    setVehicleId('all');
  };

  const rangeLabel = dateFrom.toDateString() === dateTo.toDateString()
    ? format(dateFrom, "d 'de' MMMM, yyyy", { locale: es })
    : `${format(dateFrom, 'dd/MM/yyyy')} – ${format(dateTo, 'dd/MM/yyyy')}`;

  const handleExportRoutes = () => {
    if (!routeReports) return;
    exportToExcelJS(
      routeReports.map(r => ({
        Fecha: r.date,
        Ruta: r.name,
        Estado: statusLabels[r.status] || r.status,
        Conductor: r.driverName || '—',
        Vehículo: r.vehiclePlate || '—',
        'Paradas totales': r.totalStops,
        Completadas: r.doneStops,
        Omitidas: r.skippedStops,
        Fallidas: r.failedStops,
        'Duración (min)': r.durationMin ?? '—',
      })),
      `rutas_${filters.dateFrom}_${filters.dateTo}`
    );
  };

  const handleExportDrivers = () => {
    if (!driverReports) return;
    exportToExcelJS(
      driverReports.map(d => ({
        Conductor: d.driverName || '—',
        'Rutas totales': d.totalRoutes,
        'Rutas completadas': d.completedRoutes,
        Entregas: d.doneStops,
        Omitidas: d.skippedStops,
        Fallidas: d.failedStops,
        'Duración prom. (min)': d.avgDurationMin,
      })),
      `conductores_${filters.dateFrom}_${filters.dateTo}`
    );
  };

  const handleExportVehicles = () => {
    if (!vehicleReports) return;
    exportToExcelJS(
      vehicleReports.map(v => ({
        Placa: v.plate,
        Modelo: v.label || '—',
        'Rutas totales': v.totalRoutes,
        'Rutas completadas': v.completedRoutes,
        'Paradas totales': v.totalStops,
        Entregas: v.doneStops,
      })),
      `vehiculos_${filters.dateFrom}_${filters.dateTo}`
    );
  };

  const handleExportRoutesCsv = () => {
    if (!routeReports) return;
    exportToCsv(
      routeReports.map(r => ({
        Fecha: r.date, Ruta: r.name, Estado: statusLabels[r.status] || r.status,
        Conductor: r.driverName || '', Vehículo: r.vehiclePlate || '',
        Paradas_totales: r.totalStops, Completadas: r.doneStops,
        Omitidas: r.skippedStops, Fallidas: r.failedStops,
        Duración_min: r.durationMin ?? '',
      })),
      `rutas_${filters.dateFrom}_${filters.dateTo}`
    );
  };

  const handleExportTrackingCsv = () => {
    if (!trackingData?.length) return;
    exportToCsv(
      trackingData.map(p => ({
        recorded_at: p.recorded_at, driver_id: p.driver_id,
        lat: p.lat, lng: p.lng, speed_mps: p.speed_mps ?? '',
        heading: p.heading ?? '', accuracy_m: p.accuracy_m ?? '',
        route_id: p.route_id ?? '', company_id: p.company_id,
      })),
      `tracking_${filters.dateFrom}_${filters.dateTo}`
    );
  };


  const fmtDuration = (min: number) => {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
          <p className="text-sm text-muted-foreground capitalize">{rangeLabel}</p>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date From */}
            <div className="space-y-1.5">
              <Label>Desde</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(d) => d && setDateFrom(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date To */}
            <div className="space-y-1.5">
              <Label>Hasta</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(d) => d && setDateTo(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Driver filter */}
            <div className="space-y-1.5">
              <Label>Conductor</Label>
              <Select value={driverId} onValueChange={setDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {drivers?.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.full_name || 'Sin nombre'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle filter */}
            <div className="space-y-1.5">
              <Label>Vehículo</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {vehicles?.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.plate} {v.label ? `- ${v.label}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Clock className="w-4 h-4 mr-1.5" />
                  Rangos rápidos
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setQuickRange('today')}>Hoy</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQuickRange('yesterday')}>Ayer</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQuickRange('last7')}>Últimos 7 días</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQuickRange('week')}>Esta semana</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQuickRange('month')}>Este mes</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQuickRange('last30')}>Últimos 30 días</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" onClick={handleReset}>
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily" className="gap-1.5">
            <CalendarDays className="h-4 w-4" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="routes" className="gap-1.5">
            <Route className="h-4 w-4" /> Por Ruta
          </TabsTrigger>
          <TabsTrigger value="drivers" className="gap-1.5">
            <Users className="h-4 w-4" /> Por Conductor
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="gap-1.5">
            <Truck className="h-4 w-4" /> Por Vehículo
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-1.5" onClick={() => setTrackingEnabled(true)}>
            <MapPin className="h-4 w-4" /> Tracking
          </TabsTrigger>
        </TabsList>

        {/* ── DAILY SUMMARY ── */}
        <TabsContent value="daily">
          {loadingSummary ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-20" /></CardHeader><CardContent><Skeleton className="h-8 w-12" /></CardContent></Card>
              ))}
            </div>
          ) : summary ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard icon={<Users className="h-5 w-5 text-primary" />} label="Conductores" value={summary.activeDrivers} />
              <StatCard icon={<Route className="h-5 w-5 text-[hsl(var(--status-active))]" />} label="Rutas completadas" value={summary.completedRoutes} />
              <StatCard icon={<CheckCircle2 className="h-5 w-5 text-[hsl(var(--status-active))]" />} label="Entregas" value={summary.totalDeliveries} />
              <StatCard icon={<SkipForward className="h-5 w-5 text-[hsl(var(--status-warning))]" />} label="Omitidas" value={summary.skippedDeliveries} />
              <StatCard icon={<XCircle className="h-5 w-5 text-[hsl(var(--status-danger))]" />} label="Fallidas" value={summary.failedDeliveries} />
              <StatCard icon={<Clock className="h-5 w-5 text-muted-foreground" />} label="Tiempo prom./ruta" value={summary.avgTimePerRouteMin > 0 ? fmtDuration(summary.avgTimePerRouteMin) : '—'} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sin datos para el rango seleccionado.</p>
          )}
        </TabsContent>

        {/* ── ROUTES ── */}
        <TabsContent value="routes" className="space-y-3">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleExportRoutesCsv} disabled={!routeReports?.length}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportRoutes} disabled={!routeReports?.length}>
              <Download className="h-4 w-4 mr-1.5" /> Excel
            </Button>
          </div>
          {loadingRoutes ? (
            <p className="text-muted-foreground text-sm">Cargando...</p>
          ) : routeReports?.length ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Ruta</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Conductor</TableHead>
                      <TableHead>Vehículo</TableHead>
                      <TableHead>Avance</TableHead>
                      <TableHead className="text-right">Duración</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routeReports.map(r => {
                      const pct = r.totalStops > 0 ? Math.round((r.doneStops / r.totalStops) * 100) : 0;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{r.date}</TableCell>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === 'done' ? 'default' : 'secondary'} className="text-xs">
                              {statusLabels[r.status] || r.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{r.driverName || '—'}</TableCell>
                          <TableCell>{r.vehiclePlate || '—'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-[140px]">
                              <Progress value={pct} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {r.doneStops}/{r.totalStops}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {r.durationMin ? fmtDuration(r.durationMin) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground text-sm">Sin rutas para el rango seleccionado.</p>
          )}
        </TabsContent>

        {/* ── DRIVERS ── */}
        <TabsContent value="drivers" className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportDrivers} disabled={!driverReports?.length}>
              <Download className="h-4 w-4 mr-1.5" /> Exportar Excel
            </Button>
          </div>
          {loadingDrivers ? (
            <p className="text-muted-foreground text-sm">Cargando...</p>
          ) : driverReports?.length ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conductor</TableHead>
                      <TableHead>Rutas</TableHead>
                      <TableHead>Completadas</TableHead>
                      <TableHead>Entregas</TableHead>
                      <TableHead>Omitidas</TableHead>
                      <TableHead>Fallidas</TableHead>
                      <TableHead className="text-right">Duración prom.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {driverReports.map(d => (
                      <TableRow key={d.driverId}>
                        <TableCell className="font-medium">{d.driverName || '—'}</TableCell>
                        <TableCell>{d.totalRoutes}</TableCell>
                        <TableCell>{d.completedRoutes}</TableCell>
                        <TableCell>
                          <span className="text-[hsl(var(--status-active))]">{d.doneStops}</span>
                          <span className="text-muted-foreground">/{d.totalStops}</span>
                        </TableCell>
                        <TableCell className="text-[hsl(var(--status-warning))]">{d.skippedStops}</TableCell>
                        <TableCell className="text-[hsl(var(--status-danger))]">{d.failedStops}</TableCell>
                        <TableCell className="text-right">{d.avgDurationMin > 0 ? fmtDuration(d.avgDurationMin) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground text-sm">Sin datos de conductores para el rango seleccionado.</p>
          )}
        </TabsContent>

        {/* ── VEHICLES ── */}
        <TabsContent value="vehicles" className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportVehicles} disabled={!vehicleReports?.length}>
              <Download className="h-4 w-4 mr-1.5" /> Exportar Excel
            </Button>
          </div>
          {loadingVehicles ? (
            <p className="text-muted-foreground text-sm">Cargando...</p>
          ) : vehicleReports?.length ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placa</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Rutas</TableHead>
                      <TableHead>Completadas</TableHead>
                      <TableHead>Entregas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicleReports.map(v => (
                      <TableRow key={v.vehicleId}>
                        <TableCell className="font-medium">{v.plate}</TableCell>
                        <TableCell>{v.label || '—'}</TableCell>
                        <TableCell>{v.totalRoutes}</TableCell>
                        <TableCell>{v.completedRoutes}</TableCell>
                        <TableCell>
                          <span className="text-[hsl(var(--status-active))]">{v.doneStops}</span>
                          <span className="text-muted-foreground">/{v.totalStops}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground text-sm">Sin datos de vehículos para el rango seleccionado.</p>
          )}
        </TabsContent>

        {/* ── TRACKING ── */}
        <TabsContent value="tracking" className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportTrackingCsv} disabled={!trackingData?.length}>
              <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
            </Button>
          </div>
          {loadingTracking ? (
            <p className="text-muted-foreground text-sm">Cargando puntos de tracking...</p>
          ) : trackingData?.length ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {trackingData.length} puntos de ubicación
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead>Lat</TableHead>
                      <TableHead>Lng</TableHead>
                      <TableHead>Vel. (m/s)</TableHead>
                      <TableHead>Precisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trackingData.slice(0, 100).map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(p.recorded_at), 'dd/MM HH:mm:ss')}
                        </TableCell>
                        <TableCell className="text-xs">{Number(p.lat).toFixed(5)}</TableCell>
                        <TableCell className="text-xs">{Number(p.lng).toFixed(5)}</TableCell>
                        <TableCell className="text-xs">{p.speed_mps != null ? Number(p.speed_mps).toFixed(1) : '—'}</TableCell>
                        <TableCell className="text-xs">{p.accuracy_m != null ? `${Number(p.accuracy_m).toFixed(0)}m` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {trackingData.length > 100 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Mostrando 100 de {trackingData.length} puntos. Exporta CSV para ver todos.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground text-sm">Sin datos de tracking para el rango seleccionado.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="card-stat">
      <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
        {icon}
        <span className="text-2xl font-bold text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

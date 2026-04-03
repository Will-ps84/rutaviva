import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { toast } from '@/hooks/use-toast';
import type { DashboardKPIs, VehicleOccupancy, ZoneData, StopDetail } from '@/hooks/useDashboardOperativo';

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };
const STRIPE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };

function addHeaders(ws: ExcelJS.Worksheet, headers: string[]) {
  const row = ws.addRow(headers);
  row.eachCell(cell => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: 'center' };
  });
}

function autoWidth(ws: ExcelJS.Worksheet) {
  ws.columns.forEach(col => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, cell => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 4, 40);
  });
}

function stripeRows(ws: ExcelJS.Worksheet, startRow: number) {
  ws.eachRow((row, idx) => {
    if (idx >= startRow && idx % 2 === 0) {
      row.eachCell(cell => { cell.fill = STRIPE_FILL; });
    }
  });
}

export async function exportDashboardExcel(
  kpis: DashboardKPIs,
  vehicles: VehicleOccupancy[],
  zones: ZoneData[],
  stops: StopDetail[],
  period: string,
  companyName?: string,
) {
  if (stops.length === 0 && vehicles.length === 0) {
    toast({ title: 'Sin datos para exportar', variant: 'destructive' });
    return;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'RutaViva';
  wb.created = new Date();

  // Sheet 1: KPIs
  const ws1 = wb.addWorksheet('KPIs');
  ws1.addRow([`RutaViva — ${companyName || ''} — Dashboard Operativo — ${period}`]);
  ws1.getRow(1).font = { bold: true, size: 12 };
  ws1.addRow([]);
  addHeaders(ws1, ['Indicador', 'Valor']);
  ws1.addRow(['Total Pedidos', kpis.totalOrders]);
  ws1.addRow(['Completados', kpis.completedOrders]);
  ws1.addRow(['Pendientes', kpis.pendingOrders]);
  ws1.addRow(['% Completado', `${kpis.completionPct}%`]);
  ws1.addRow(['Total KG', kpis.totalWeightKg]);
  ws1.addRow(['KG Entregados', kpis.deliveredWeightKg]);
  ws1.addRow(['KG Pendientes', kpis.pendingWeightKg]);
  ws1.addRow(['Ocupación Promedio Flota', `${kpis.avgFleetOccupancy}%`]);
  ws1.addRow(['Vehículos Activos', kpis.activeVehicles]);
  ws1.addRow(['Costo Estimado (S/.)', kpis.estimatedCost]);
  ws1.addRow(['Costo por Entrega (S/.)', kpis.costPerDelivery]);
  autoWidth(ws1);
  stripeRows(ws1, 3);

  // Sheet 2: Vehicles
  const ws2 = wb.addWorksheet('Vehículos');
  ws2.addRow([`Ocupación por Vehículo — ${period}`]);
  ws2.getRow(1).font = { bold: true, size: 12 };
  ws2.addRow([]);
  addHeaders(ws2, ['Placa', 'Conductor', 'Pedidos', 'KG Cargados', 'Capacidad KG', '% Ocupación', 'Estado']);
  for (const v of vehicles) {
    const statusLabels: Record<string, string> = { in_progress: 'EN RUTA', done: 'COMPLETADO', draft: 'DISPONIBLE', published: 'DISPONIBLE' };
    ws2.addRow([v.plate, v.driverName || '—', v.assignedOrders, v.loadedKg, v.capacityKg ?? '—', `${v.occupancyPct}%`, statusLabels[v.routeStatus] || v.routeStatus]);
  }
  autoWidth(ws2);
  stripeRows(ws2, 3);

  // Sheet 3: Zones
  const ws3 = wb.addWorksheet('Por Zona');
  ws3.addRow([`Distribución por Zona — ${period}`]);
  ws3.getRow(1).font = { bold: true, size: 12 };
  ws3.addRow([]);
  addHeaders(ws3, ['Zona', 'Pedidos', 'Completados', 'Pendientes', 'KG', '% del Total']);
  for (const z of zones) {
    ws3.addRow([z.zone, z.total, z.completed, z.pending, z.weightKg, `${z.pctOfTotal}%`]);
  }
  autoWidth(ws3);
  stripeRows(ws3, 3);

  // Sheet 4: All stops
  const ws4 = wb.addWorksheet('Listado Pedidos');
  ws4.addRow([`Listado Completo de Pedidos — ${period}`]);
  ws4.getRow(1).font = { bold: true, size: 12 };
  ws4.addRow([]);
  addHeaders(ws4, ['Ruta', 'Dirección', 'Destinatario', 'Zona', 'Peso KG', 'Estado', 'Completado']);
  const statusMap: Record<string, string> = { done: 'Completado', pending: 'Pendiente', skipped: 'Omitido', failed: 'Fallido', arrived: 'Llegó' };
  for (const s of stops) {
    ws4.addRow([s.routeName, s.address, s.recipientName || '—', s.zone || '—', s.weightKg ?? '—', statusMap[s.status] || s.status, s.completedAt ? new Date(s.completedAt).toLocaleString() : '—']);
  }
  autoWidth(ws4);
  stripeRows(ws4, 3);

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `dashboard_operativo_${period}.xlsx`);
}

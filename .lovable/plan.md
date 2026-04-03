

# Plan: Dashboard Operativo en Reportes

## Resumen
Agregar un tab "Dashboard Operativo" a la sección de Reportes con KPIs avanzados (pedidos, peso, ocupación de flota, costos, zonas), tablas de ocupación por vehículo, gráfico de barras por zona, y exportación Excel multi-hoja. Requiere nuevas columnas en la base de datos y un nuevo hook de datos.

## Cambios en Base de Datos

**Migración 1** — Agregar columnas opcionales:
- `route_stops.weight_kg` (numeric, nullable, default null) — peso por parada
- `route_stops.zone` (text, nullable, default null) — zona geográfica
- `routes.cost_per_km` (numeric, nullable, default null) — costo por km
- `routes.distance_km` (numeric, nullable, default null) — distancia recorrida

Estas columnas son opcionales; la UI mostrará "—" cuando no haya datos.

## Archivos a Crear/Modificar

### 1. `src/hooks/useDashboardOperativo.ts` (nuevo)
Hook con react-query que consulta routes + route_stops + vehicles + profiles para el rango de filtros, calculando:
- Total pedidos del día, completados vs pendientes
- Total KG (sum weight_kg), entregados vs pendientes
- Ocupación promedio de flota (sum weight_kg por vehículo / capacity del vehículo)
- Costo estimado (sum distance_km * cost_per_km)
- Agrupación por zona
- Detalle por vehículo con conductor, pedidos, KG, capacidad, % ocupación, estado

Acepta `ReportFilters` extendido con campo `zone` opcional.

### 2. `src/components/reports/DashboardOperativo.tsx` (nuevo)
Componente del tab con 3 secciones:

**Sección A — KPIs (grid 2x3):** 6 tarjetas con Total Pedidos, Total KG, Completados %, Peso Entregado, Costo Total, Costo/Entrega. Colores condicionales (verde/amarillo/rojo) según umbrales.

**Sección B — Tabla Ocupación por Vehículo:** Columnas: Placa, Conductor, Pedidos, KG, Capacidad, % Ocupación (barra Progress), Estado (badge). Badges: >85% rojo "Casi lleno", 60-85% verde "Óptimo", <60% amarillo "Subutilizado".

**Sección C — Barras por Zona:** Gráfico con recharts (BarChart horizontal) usando la librería de charts existente. Teal para completados, gris para pendientes.

**Botón Exportar Excel** que genera .xlsx con 4 hojas usando exceljs.

### 3. `src/lib/exportDashboardExcel.ts` (nuevo)
Función que genera Excel con:
- Hoja 1: KPIs del período
- Hoja 2: Detalle por vehículo
- Hoja 3: Pedidos por zona
- Hoja 4: Listado completo de pedidos

### 4. `src/pages/app/Reports.tsx` (modificar)
- Agregar estado `zone` al filtro
- Agregar dropdown "Zona" en la barra de filtros (Lima Norte, Lima Sur, Lima Este, Lima Moderna, Callao, Provincias)
- Agregar tab "Dashboard Operativo" con ícono BarChart3
- Extender `ReportFilters` con campo `zone`

### 5. `src/hooks/useReportsData.ts` (modificar)
- Agregar `zone?: string` a `ReportFilters`
- Aplicar filtro de zona en `applyFilters` cuando corresponda (filtra en route_stops.zone)

## Flujo de Datos

```text
Filtros (fecha, conductor, vehículo, zona)
  │
  ├─► useDashboardOperativo()
  │     ├─ Query: routes + route_stops (con weight_kg, zone)
  │     ├─ Query: vehicles (con capacity)
  │     └─ Calcula KPIs, agrupaciones, ocupación
  │
  └─► DashboardOperativo.tsx
        ├─ Sección A: KPI cards
        ├─ Sección B: Tabla vehículos
        ├─ Sección C: BarChart zonas
        └─ Botón: exportDashboardExcel()
```

## Notas Técnicas
- Los campos weight_kg, zone, cost_per_km, distance_km serán null por defecto — no rompen datos existentes
- Costo estimado y ocupación mostrarán "—" si no hay datos de peso/costo configurados
- Todos los cálculos client-side sobre datos ya filtrados por RLS
- Responsive: tarjetas en 1 columna en móvil, 2-3 en tablet, grid completo en desktop
- Loading skeletons mientras cargan datos


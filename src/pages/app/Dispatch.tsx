import { useState } from 'react';
import { MapPin, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanySetupCard } from '@/components/company/CompanySetupCard';
import { useUserCompany } from '@/hooks/useCompany';
import { 
  useDriverLocations, 
  useActiveRoutes, 
  useDispatchKPIs, 
  useCompanyDrivers,
  useFilteredData,
  DispatchFilters 
} from '@/hooks/useDispatchData';
import { RealtimeMapView } from '@/components/maps/RealtimeMapView';
import { DispatchFiltersBar } from '@/components/dispatch/DispatchFiltersBar';
import { DispatchKPIs } from '@/components/dispatch/DispatchKPIs';
import { ActiveRoutesList } from '@/components/dispatch/ActiveRoutesList';
import { AlertsPanel } from '@/components/dispatch/AlertsPanel';

export default function Dispatch() {
  const { data: company, isLoading: companyLoading } = useUserCompany();
  const { locations, stats, isLoading: locationsLoading, refetch } = useDriverLocations();
  const { data: activeRoutes = [], isLoading: routesLoading } = useActiveRoutes();
  const { data: drivers = [] } = useCompanyDrivers();
  
  const [filters, setFilters] = useState<DispatchFilters>({
    routeId: null,
    driverId: null,
    status: null,
    showAllFleet: true,
  });

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  // Compute KPIs
  const kpis = useDispatchKPIs(stats, activeRoutes);
  
  // Apply filters
  const { locations: filteredLocations, routes: filteredRoutes, hasNullRouteLocations } = useFilteredData(
    locations,
    activeRoutes,
    filters
  );

  // Handle route selection - also updates filter
  const handleRouteSelect = (routeId: string | null) => {
    setSelectedRouteId(routeId);
    setFilters(prev => ({ ...prev, routeId }));
  };

  // Get center point for selected route
  // Get center point for selected route - find by driver_id since route_id may be null
  const selectedRoute = selectedRouteId ? filteredRoutes.find(r => r.id === selectedRouteId) : null;
  const selectedRouteLocation = selectedRoute?.last_location || null;

  // Show company setup if no company
  if (!companyLoading && !company) {
    return <CompanySetupCard />;
  }
  
  if (companyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Dashboard de Despacho</h1>
          <p className="text-muted-foreground">
            Monitorea tu flota en tiempo real - {company?.name}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refetch}
          disabled={locationsLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${locationsLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Filters Bar */}
      <DispatchFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        activeRoutes={activeRoutes}
        drivers={drivers}
      />

      {/* KPIs */}
      <DispatchKPIs
        activeDrivers={kpis.activeDrivers}
        routesInProgress={kpis.routesInProgress}
        avgProgress={kpis.avgProgress}
        noSignal={stats.noSignal}
      />

      {/* Warning for null route_id */}
      {hasNullRouteLocations && filters.routeId && (
        <div className="bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning))] text-sm px-4 py-2 rounded-lg">
          ⚠ Puntos sin ruta asociada — algunos puntos GPS no tienen route_id asignado.
        </div>
      )}

      {/* Main Content: Map + Routes List + Alerts Panel */}
      <div className="flex gap-6">
        {/* Left: Map (flex-1) + Routes List (col) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <Card className="lg:col-span-2 h-[500px] relative overflow-hidden">
            <CardHeader className="absolute top-4 left-4 z-10 bg-card/95 backdrop-blur-sm rounded-lg shadow-panel p-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Mapa en tiempo real
                {filteredLocations.length > 0 && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {filteredLocations.length} conductor{filteredLocations.length !== 1 ? 'es' : ''}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-full">
              {locationsLoading ? (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <RealtimeMapView
                  drivers={filteredLocations}
                  className="h-full"
                  centerOn={selectedRouteLocation ? { lat: selectedRouteLocation.lat, lng: selectedRouteLocation.lng } : undefined}
                  stops={filteredRoutes.flatMap(r => r.stops ?? [])}
                />
              )}
            </CardContent>
          </Card>

          {/* Routes List */}
          <ActiveRoutesList
            routes={filteredRoutes}
            selectedRouteId={selectedRouteId}
            onRouteSelect={handleRouteSelect}
          />
        </div>

        {/* Right: Alerts Panel */}
        <AlertsPanel
          onFocusDriver={(driverId) => {
            const loc = filteredLocations.find(l => l.driver_id === driverId);
            if (loc) {
              const route = filteredRoutes.find(r => r.driver_id === driverId);
              if (route) handleRouteSelect(route.id);
            }
          }}
        />
      </div>
    </div>
  );
}

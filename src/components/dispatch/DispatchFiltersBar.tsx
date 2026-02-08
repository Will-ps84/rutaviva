import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Filter } from 'lucide-react';
import { ActiveRoute, DispatchFilters, DriverStatus } from '@/hooks/useDispatchData';

interface DispatchFiltersBarProps {
  filters: DispatchFilters;
  onFiltersChange: (filters: DispatchFilters) => void;
  activeRoutes: ActiveRoute[];
  drivers: Array<{ id: string; full_name: string | null }>;
}

export function DispatchFiltersBar({
  filters,
  onFiltersChange,
  activeRoutes,
  drivers,
}: DispatchFiltersBarProps) {
  const updateFilter = <K extends keyof DispatchFilters>(
    key: K,
    value: DispatchFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-card border rounded-lg">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filtros</span>
      </div>

      {/* Route Filter */}
      <div className="flex-1 min-w-[180px]">
        <Select
          value={filters.routeId || 'all'}
          onValueChange={(value) => updateFilter('routeId', value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todas las rutas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las rutas</SelectItem>
            {activeRoutes.map((route) => (
              <SelectItem key={route.id} value={route.id}>
                {route.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Driver Filter */}
      <div className="flex-1 min-w-[180px]">
        <Select
          value={filters.driverId || 'all'}
          onValueChange={(value) => updateFilter('driverId', value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos los conductores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los conductores</SelectItem>
            {drivers.map((driver) => (
              <SelectItem key={driver.id} value={driver.id}>
                {driver.full_name || 'Sin nombre'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status Filter */}
      <div className="flex-1 min-w-[160px]">
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) => 
            updateFilter('status', value === 'all' ? null : value as DriverStatus)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-status-active" />
                Activo
              </span>
            </SelectItem>
            <SelectItem value="stopped">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-status-warning" />
                Detenido
              </span>
            </SelectItem>
            <SelectItem value="noSignal">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                Sin señal
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Show All Fleet Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="show-all-fleet"
          checked={filters.showAllFleet}
          onCheckedChange={(checked) => updateFilter('showAllFleet', checked)}
        />
        <Label htmlFor="show-all-fleet" className="text-sm cursor-pointer">
          Ver toda la flota
        </Label>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ArrowLeft, 
  MapPin, 
  Edit2, 
  Check, 
  X, 
  Send,
  Loader2,
  Truck,
  User,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MapboxView } from '@/components/maps/MapboxView';
import { useRoute, useUpdateRoute, useUpdateRouteStop, useReactivateRoute, RouteStop } from '@/hooks/useRoutes';
import { useDrivers, useVehicles } from '@/hooks/useDrivers';
import { toast } from '@/hooks/use-toast';
import { RotateCcw } from 'lucide-react';

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  in_progress: 'En Progreso',
  done: 'Completada',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted',
  published: 'bg-primary',
  in_progress: 'bg-[hsl(var(--status-warning))]',
  done: 'bg-[hsl(var(--status-active))]',
};

const stopStatusLabels: Record<string, string> = {
  pending: 'Pendiente',
  arrived: 'En sitio',
  done: 'Completado',
  skipped: 'Omitido',
};

export default function RouteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: route, isLoading, error } = useRoute(id);
  const { data: drivers } = useDrivers();
  const { data: vehicles } = useVehicles();
  const updateRoute = useUpdateRoute();
  const updateStop = useUpdateRouteStop();
  const reactivateRoute = useReactivateRoute();
  
  const [editingStop, setEditingStop] = useState<string | null>(null);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  
  const handleDriverChange = (driverId: string) => {
    if (!id) return;
    updateRoute.mutate({
      id,
      driver_id: driverId === 'none' ? null : driverId,
    });
  };
  
  const handleVehicleChange = (vehicleId: string) => {
    if (!id) return;
    updateRoute.mutate({
      id,
      vehicle_id: vehicleId === 'none' ? null : vehicleId,
    });
  };
  
  const handleEditStop = (stop: RouteStop) => {
    setEditingStop(stop.id);
    setEditLat(stop.lat?.toString() || '');
    setEditLng(stop.lng?.toString() || '');
  };
  
  const handleSaveStop = (stop: RouteStop) => {
    const lat = editLat ? parseFloat(editLat) : null;
    const lng = editLng ? parseFloat(editLng) : null;
    
    if (editLat && (isNaN(lat!) || lat! < -90 || lat! > 90)) {
      toast({
        title: 'Error',
        description: 'Latitud inválida (debe estar entre -90 y 90)',
        variant: 'destructive',
      });
      return;
    }
    
    if (editLng && (isNaN(lng!) || lng! < -180 || lng! > 180)) {
      toast({
        title: 'Error',
        description: 'Longitud inválida (debe estar entre -180 y 180)',
        variant: 'destructive',
      });
      return;
    }
    
    updateStop.mutate({
      id: stop.id,
      route_id: stop.route_id,
      lat,
      lng,
    });
    
    setEditingStop(null);
  };
  
  const handlePublish = () => {
    if (!id) return;
    
    // Check for missing coordinates
    const missingCoords = route?.route_stops?.filter(s => !s.lat || !s.lng) || [];
    if (missingCoords.length > 0) {
      toast({
        title: 'Advertencia',
        description: `${missingCoords.length} paradas no tienen coordenadas. La ruta se publicará igual.`,
      });
    }
    
    updateRoute.mutate({
      id,
      status: 'published',
    });
    
    setShowPublishDialog(false);
  };
  
  const handleReactivate = () => {
    if (!id) return;
    reactivateRoute.mutate(id);
    setShowReactivateDialog(false);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (error || !route) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Error al cargar la ruta</h2>
        <p className="text-muted-foreground">
          {error?.message || 'La ruta no fue encontrada'}
        </p>
        <Button className="mt-4" onClick={() => navigate('/app/routes')}>
          Volver a Rutas
        </Button>
      </div>
    );
  }
  
  const stops = route.route_stops || [];
  const missingCoordsCount = stops.filter(s => !s.lat || !s.lng).length;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/routes')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{route.name}</h1>
            <p className="text-muted-foreground">
              {format(new Date(route.date), 'EEEE, d MMMM yyyy', { locale: es })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={statusColors[route.status]}>
            {statusLabels[route.status]}
          </Badge>
          {route.status === 'draft' && (
            <Button onClick={() => setShowPublishDialog(true)}>
              <Send className="mr-2 h-4 w-4" />
              Publicar Ruta
            </Button>
          )}
          {route.status === 'done' && (
            <Button 
              variant="outline" 
              onClick={() => setShowReactivateDialog(true)}
              disabled={reactivateRoute.isPending}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reactivar Ruta
            </Button>
          )}
        </div>
      </div>
      
      {/* Assignment Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Conductor Asignado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={route.driver_id || 'none'}
              onValueChange={handleDriverChange}
              disabled={route.status !== 'draft' && route.status !== 'published'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar conductor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {drivers?.map(driver => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.full_name || 'Sin nombre'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Vehículo Asignado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={route.vehicle_id || 'none'}
              onValueChange={handleVehicleChange}
              disabled={route.status !== 'draft' && route.status !== 'published'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar vehículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {vehicles?.map(vehicle => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate} {vehicle.label && `- ${vehicle.label}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
      
      {/* Map and Stops */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Map */}
        <Card className="lg:row-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Mapa de Ruta
              {missingCoordsCount > 0 && (
                <Badge variant="outline" className="ml-2 text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning))]">
                  {missingCoordsCount} sin ubicación
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] lg:h-[500px]">
              <MapboxView 
                stops={stops
                  .filter(s => s.lat !== null && s.lng !== null)
                  .map(s => ({
                    lat: s.lat!,
                    lng: s.lng!,
                    address: s.address_text,
                    seq: s.seq,
                  }))} 
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Stops Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Paradas ({stops.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead className="w-32">Coordenadas</TableHead>
                    <TableHead className="w-24">Estado</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stops.map((stop) => (
                    <TableRow key={stop.id}>
                      <TableCell className="font-medium">{stop.seq}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={stop.address_text}>
                        {stop.address_text}
                      </TableCell>
                      <TableCell>
                        {editingStop === stop.id ? (
                          <div className="flex gap-1">
                            <Input
                              className="w-16 h-7 text-xs"
                              placeholder="Lat"
                              value={editLat}
                              onChange={(e) => setEditLat(e.target.value)}
                            />
                            <Input
                              className="w-16 h-7 text-xs"
                              placeholder="Lng"
                              value={editLng}
                              onChange={(e) => setEditLng(e.target.value)}
                            />
                          </div>
                        ) : stop.lat && stop.lng ? (
                          <span className="text-xs text-muted-foreground">
                            {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-xs text-[hsl(var(--status-warning))]">Sin ubicación</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {stopStatusLabels[stop.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {editingStop === stop.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleSaveStop(stop)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setEditingStop(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleEditStop(stop)}
                            disabled={route.status === 'done'}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Publish Confirmation */}
      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Publicar esta ruta?</AlertDialogTitle>
            <AlertDialogDescription>
              Al publicar la ruta, estará disponible para ser iniciada por el conductor asignado.
              {missingCoordsCount > 0 && (
                <span className="block mt-2 text-[hsl(var(--status-warning))]">
                  ⚠️ {missingCoordsCount} paradas no tienen coordenadas asignadas.
                </span>
              )}
              {!route.driver_id && (
                <span className="block mt-2 text-[hsl(var(--status-warning))]">
                  ⚠️ No hay conductor asignado a esta ruta.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish}>
              Publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Reactivate Confirmation */}
      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reactivar esta ruta?</AlertDialogTitle>
            <AlertDialogDescription>
              La ruta volverá al estado "En Progreso". El conductor y vehículo asignados se mantendrán.
              {route.driver?.full_name && (
                <span className="block mt-2">
                  Conductor: <strong>{route.driver.full_name}</strong>
                </span>
              )}
              {route.vehicle && (
                <span className="block mt-1">
                  Vehículo: <strong>{route.vehicle.plate}</strong>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivate}>
              Reactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

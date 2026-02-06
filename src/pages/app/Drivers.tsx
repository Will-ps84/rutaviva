import { useState } from 'react';
import { 
  Plus, 
  User, 
  Truck, 
  Loader2, 
  Trash2,
  Phone,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompanySetupCard } from '@/components/company/CompanySetupCard';
import { useDrivers, useVehicles, useCreateVehicle, useDeleteVehicle } from '@/hooks/useDrivers';
import { useUserCompany } from '@/hooks/useCompany';
import { toast } from '@/hooks/use-toast';

export default function DriversPage() {
  const { data: company, isLoading: companyLoading } = useUserCompany();
  const { data: drivers, isLoading: driversLoading, error: driversError, refetch: refetchDrivers } = useDrivers();
  const { data: vehicles, isLoading: vehiclesLoading, error: vehiclesError, refetch: refetchVehicles } = useVehicles();
  const createVehicle = useCreateVehicle();
  const deleteVehicle = useDeleteVehicle();
  
  // Driver invite dialog
  const [showDriverDialog, setShowDriverDialog] = useState(false);
  const [driverEmail, setDriverEmail] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  
  // Vehicle dialog
  const [showVehicleDialog, setShowVehicleDialog] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleLabel, setVehicleLabel] = useState('');
  
  // Delete confirmation
  const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null);
  
  const handleInviteDriver = async () => {
    // For MVP: Show info about manual driver creation
    toast({
      title: 'Función en desarrollo',
      description: 'Por ahora, los conductores deben registrarse manualmente y luego asignarles el rol de driver desde la base de datos.',
    });
    setShowDriverDialog(false);
    resetDriverForm();
  };
  
  const handleCreateVehicle = async () => {
    if (!vehiclePlate.trim()) {
      toast({
        title: 'Error',
        description: 'La placa es requerida',
        variant: 'destructive',
      });
      return;
    }
    
    if (!company?.id) {
      toast({
        title: 'Error',
        description: 'Debes crear una empresa primero',
        variant: 'destructive',
      });
      return;
    }
    
    await createVehicle.mutateAsync({
      plate: vehiclePlate.trim().toUpperCase(),
      label: vehicleLabel.trim() || null,
      company_id: company.id,
    });
    
    setShowVehicleDialog(false);
    resetVehicleForm();
  };
  
  const handleDeleteVehicle = () => {
    if (deleteVehicleId) {
      deleteVehicle.mutate(deleteVehicleId);
      setDeleteVehicleId(null);
    }
  };
  
  const resetDriverForm = () => {
    setDriverEmail('');
    setDriverName('');
    setDriverPhone('');
  };
  
  const resetVehicleForm = () => {
    setVehiclePlate('');
    setVehicleLabel('');
  };
  
  // Show company setup if no company
  if (!companyLoading && !company) {
    return <CompanySetupCard />;
  }
  
  const isLoading = companyLoading || driversLoading || vehiclesLoading;
  const hasError = driversError || vehiclesError;
  
  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-destructive mb-2">
            Error cargando conductores/vehículos
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            {driversError?.message || vehiclesError?.message || 'Error desconocido'}
          </p>
        </div>
        <Button 
          onClick={() => {
            refetchDrivers();
            refetchVehicles();
          }}
          variant="outline"
        >
          Reintentar
        </Button>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6" />
          Conductores y Vehículos
        </h1>
        <p className="text-muted-foreground">
          Gestiona tu flota de conductores y vehículos
        </p>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="drivers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="drivers" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Conductores ({drivers?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Vehículos ({vehicles?.length || 0})
          </TabsTrigger>
        </TabsList>
        
        {/* Drivers Tab */}
        <TabsContent value="drivers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Conductores</CardTitle>
                <CardDescription>
                  Lista de conductores registrados en tu empresa
                </CardDescription>
              </div>
              <Button onClick={() => setShowDriverDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Conductor
              </Button>
            </CardHeader>
            <CardContent>
              {drivers && drivers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Registrado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.map((driver) => (
                      <TableRow key={driver.id}>
                        <TableCell className="font-medium">
                          {driver.full_name || 'Sin nombre'}
                        </TableCell>
                        <TableCell>
                          {driver.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {driver.phone}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(driver.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No hay conductores</h3>
                  <p className="text-muted-foreground mb-4">
                    Agrega conductores para asignarlos a las rutas
                  </p>
                  <Button onClick={() => setShowDriverDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Conductor
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Vehicles Tab */}
        <TabsContent value="vehicles">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Vehículos</CardTitle>
                <CardDescription>
                  Lista de vehículos de tu flota
                </CardDescription>
              </div>
              <Button onClick={() => setShowVehicleDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar Vehículo
              </Button>
            </CardHeader>
            <CardContent>
              {vehicles && vehicles.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placa</TableHead>
                      <TableHead>Modelo / Etiqueta</TableHead>
                      <TableHead>Registrado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((vehicle) => (
                      <TableRow key={vehicle.id}>
                        <TableCell className="font-medium font-mono">
                          {vehicle.plate}
                        </TableCell>
                        <TableCell>
                          {vehicle.label || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(vehicle.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteVehicleId(vehicle.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No hay vehículos</h3>
                  <p className="text-muted-foreground mb-4">
                    Agrega vehículos para asignarlos a las rutas
                  </p>
                  <Button onClick={() => setShowVehicleDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Vehículo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Add Driver Dialog */}
      <Dialog open={showDriverDialog} onOpenChange={setShowDriverDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Conductor</DialogTitle>
            <DialogDescription>
              Invita a un nuevo conductor a tu empresa
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="driver-email">Email</Label>
              <Input
                id="driver-email"
                type="email"
                placeholder="conductor@email.com"
                value={driverEmail}
                onChange={(e) => setDriverEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="driver-name">Nombre completo</Label>
              <Input
                id="driver-name"
                placeholder="Juan Pérez"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="driver-phone">Teléfono</Label>
              <Input
                id="driver-phone"
                type="tel"
                placeholder="+51 999 999 999"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDriverDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInviteDriver}>
              <Mail className="mr-2 h-4 w-4" />
              Enviar Invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Vehicle Dialog */}
      <Dialog open={showVehicleDialog} onOpenChange={setShowVehicleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Vehículo</DialogTitle>
            <DialogDescription>
              Registra un nuevo vehículo en tu flota
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="vehicle-plate">Placa *</Label>
              <Input
                id="vehicle-plate"
                placeholder="ABC-123"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="uppercase"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicle-label">Modelo / Etiqueta</Label>
              <Input
                id="vehicle-label"
                placeholder="Toyota Hilux 2022"
                value={vehicleLabel}
                onChange={(e) => setVehicleLabel(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVehicleDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateVehicle} disabled={createVehicle.isPending}>
              {createVehicle.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Guardar Vehículo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Vehicle Confirmation */}
      <AlertDialog open={!!deleteVehicleId} onOpenChange={() => setDeleteVehicleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este vehículo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El vehículo será desasignado de todas las rutas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVehicle} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

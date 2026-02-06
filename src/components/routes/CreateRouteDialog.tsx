import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { useCreateRoute, useCreateRouteStops } from '@/hooks/useRoutes';
import { useUserCompany } from '@/hooks/useCompany';
import { geocodeAddresses } from '@/services/geocoding';
import { toast } from '@/hooks/use-toast';

interface CreateRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRouteDialog({ open, onOpenChange }: CreateRouteDialogProps) {
  const navigate = useNavigate();
  const { data: company } = useUserCompany();
  const createRoute = useCreateRoute();
  const createStops = useCreateRouteStops();
  
  const [name, setName] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [addresses, setAddresses] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      // Simple CSV parsing - assume one address per line
      const lines = text.split('\n').filter(line => line.trim());
      setAddresses(lines.join('\n'));
    };
    reader.readAsText(file);
  };
  
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa un nombre para la ruta.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!company?.id) {
      toast({
        title: 'Error',
        description: 'Debes crear una empresa primero.',
        variant: 'destructive',
      });
      return;
    }
    
    const addressLines = addresses.split('\n').filter(line => line.trim());
    
    if (addressLines.length === 0) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa al menos una dirección.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsProcessing(true);
    setProgress(0);
    
    try {
      // Step 1: Create the route
      setProgressText('Creando ruta...');
      const route = await createRoute.mutateAsync({
        name: name.trim(),
        date: format(date, 'yyyy-MM-dd'),
        company_id: company.id,
      });
      
      setProgress(10);
      
      // Step 2: Geocode addresses
      setProgressText('Geocodificando direcciones...');
      const geocodeResults = await geocodeAddresses(
        addressLines,
        (current, total) => {
          const geocodeProgress = 10 + (current / total) * 70;
          setProgress(geocodeProgress);
          setProgressText(`Geocodificando ${current}/${total}...`);
        }
      );
      
      setProgress(80);
      
      // Step 3: Create route stops
      setProgressText('Guardando paradas...');
      const stops = addressLines.map((address, index) => {
        const geocode = geocodeResults[index];
        return {
          route_id: route.id,
          seq: index + 1,
          address_text: address.trim(),
          lat: geocode?.lat ?? null,
          lng: geocode?.lng ?? null,
          status: 'pending' as const,
          planned_window_start: null,
          planned_window_end: null,
          notes: null,
        };
      });
      
      await createStops.mutateAsync(stops);
      
      setProgress(100);
      
      // Count successful geocodes
      const geocodedCount = geocodeResults.filter(r => r !== null).length;
      const failedCount = addressLines.length - geocodedCount;
      
      toast({
        title: 'Ruta creada',
        description: failedCount > 0
          ? `Se crearon ${addressLines.length} paradas. ${failedCount} direcciones requieren ubicación manual.`
          : `Se crearon ${addressLines.length} paradas exitosamente.`,
      });
      
      // Reset form and close
      setName('');
      setDate(new Date());
      setAddresses('');
      onOpenChange(false);
      
      // Navigate to route detail
      navigate(`/app/routes/${route.id}`);
      
    } catch (error) {
      console.error('Error creating route:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al crear la ruta',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressText('');
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nueva Ruta</DialogTitle>
          <DialogDescription>
            Crea una nueva ruta de reparto con las direcciones de entrega.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre de la ruta</Label>
            <Input
              id="name"
              placeholder="Ej: Ruta Miraflores AM"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isProcessing}
            />
          </div>
          
          <div className="grid gap-2">
            <Label>Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                  disabled={isProcessing}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP', { locale: es }) : 'Seleccionar fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="addresses">Direcciones (una por línea)</Label>
              <label className="cursor-pointer">
                <Input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                />
                <Button variant="ghost" size="sm" asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    Cargar CSV
                  </span>
                </Button>
              </label>
            </div>
            <Textarea
              id="addresses"
              placeholder="Av. Javier Prado 1234, San Isidro&#10;Calle Los Olivos 456, Miraflores&#10;Jr. de la Unión 789, Lima"
              rows={6}
              value={addresses}
              onChange={(e) => setAddresses(e.target.value)}
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground">
              {addresses.split('\n').filter(l => l.trim()).length} direcciones ingresadas
            </p>
          </div>
          
          {isProcessing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                {progressText}
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              'Crear Ruta'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

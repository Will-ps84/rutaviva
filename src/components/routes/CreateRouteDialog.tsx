import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Upload, Loader2, CheckCircle, AlertCircle, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { geocodeAddress } from '@/services/geocoding';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CreateRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AddressEntry {
  address: string;
  lat: number | null;
  lng: number | null;
  geocoding: 'idle' | 'loading' | 'success' | 'failed';
}

function createEmptyEntry(): AddressEntry {
  return { address: '', lat: null, lng: null, geocoding: 'idle' };
}

export function CreateRouteDialog({ open, onOpenChange }: CreateRouteDialogProps) {
  const navigate = useNavigate();
  const { data: company } = useUserCompany();
  const createRoute = useCreateRoute();
  const createStops = useCreateRouteStops();
  
  const [name, setName] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [entries, setEntries] = useState<AddressEntry[]>([createEmptyEntry()]);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');

  const updateEntry = (index: number, patch: Partial<AddressEntry>) => {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, ...patch } : e));
  };

  const handleGeocode = async (index: number) => {
    const addr = entries[index].address.trim();
    if (!addr) return;

    updateEntry(index, { geocoding: 'loading' });

    const result = await geocodeAddress(addr);

    if (result) {
      updateEntry(index, {
        lat: result.lat,
        lng: result.lng,
        geocoding: 'success',
      });
    } else {
      updateEntry(index, { geocoding: 'failed', lat: null, lng: null });
    }
  };

  const handleGeocodeAll = async () => {
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].address.trim() && entries[i].geocoding !== 'success') {
        await handleGeocode(i);
      }
    }
  };

  const addEntry = () => {
    setEntries(prev => [...prev, createEmptyEntry()]);
  };

  const removeEntry = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      setEntries(lines.map(line => ({
        address: line.trim(),
        lat: null,
        lng: null,
        geocoding: 'idle' as const,
      })));
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Por favor ingresa un nombre para la ruta.', variant: 'destructive' });
      return;
    }
    if (!company?.id) {
      toast({ title: 'Error', description: 'Debes crear una empresa primero.', variant: 'destructive' });
      return;
    }

    const validEntries = entries.filter(e => e.address.trim());
    if (validEntries.length === 0) {
      toast({ title: 'Error', description: 'Por favor ingresa al menos una dirección.', variant: 'destructive' });
      return;
    }

    const invalidStops = validEntries.filter(e => !e.lat || !e.lng);
    if (invalidStops.length > 0) {
      toast({
        title: 'Coordenadas faltantes',
        description: `${invalidStops.length} parada(s) sin coordenadas válidas. Geocodifica o ingresa coordenadas manualmente.`,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    setProgress(0);

    try {
      setProgressText('Creando ruta...');
      const route = await createRoute.mutateAsync({
        name: name.trim(),
        date: format(date, 'yyyy-MM-dd'),
        company_id: company.id,
      });

      setProgress(50);
      setProgressText('Guardando paradas...');

      const stops = validEntries.map((entry, index) => ({
        route_id: route.id,
        seq: index + 1,
        address_text: entry.address.trim(),
        lat: entry.lat,
        lng: entry.lng,
        status: 'pending' as const,
        planned_window_start: null,
        planned_window_end: null,
        notes: null,
      }));

      await createStops.mutateAsync(stops);
      setProgress(100);

      toast({ title: 'Ruta creada', description: `Se crearon ${validEntries.length} paradas exitosamente.` });

      setName('');
      setDate(new Date());
      setEntries([createEmptyEntry()]);
      onOpenChange(false);
      navigate(`/app/routes/${route.id}`);
    } catch (error) {
      // Error creating route — surface to user via toast
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error al crear la ruta', variant: 'destructive' });
    } finally {
      setIsSaving(false);
      setProgress(0);
      setProgressText('');
    }
  };

  const validCount = entries.filter(e => e.address.trim()).length;
  const geocodedCount = entries.filter(e => e.geocoding === 'success').length;
  const failedCount = entries.filter(e => e.geocoding === 'failed').length;
  const isGeocoding = entries.some(e => e.geocoding === 'loading');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nueva Ruta</DialogTitle>
          <DialogDescription>
            Crea una nueva ruta de reparto. Las direcciones se geocodifican automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 flex-1 overflow-hidden">
          {/* Name + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" placeholder="Ej: Ruta Miraflores AM" value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving} />
            </div>
            <div className="grid gap-1.5">
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('justify-start text-left font-normal', !date && 'text-muted-foreground')} disabled={isSaving}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP', { locale: es }) : 'Seleccionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Address header */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Direcciones</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {validCount} dirección(es) · {geocodedCount} geocodificadas
                {failedCount > 0 && <span className="text-destructive"> · {failedCount} fallidas</span>}
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={handleGeocodeAll} disabled={isSaving || isGeocoding}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Re-geocodificar
              </Button>
              <label className="cursor-pointer">
                <Input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} disabled={isSaving} />
                <Button variant="ghost" size="sm" asChild>
                  <span><Upload className="mr-1 h-3.5 w-3.5" />CSV</span>
                </Button>
              </label>
            </div>
          </div>

          {/* Address entries */}
          <ScrollArea className="flex-1 max-h-[320px] pr-3">
            <div className="space-y-2">
              {entries.map((entry, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-5 text-right shrink-0">{idx + 1}</span>
                    <Input
                      value={entry.address}
                      onChange={(e) => updateEntry(idx, { address: e.target.value, geocoding: 'idle', lat: null, lng: null })}
                      onBlur={() => handleGeocode(idx)}
                      placeholder="Ej: Av. Larco 1301, Miraflores"
                      className="flex-1"
                      disabled={isSaving}
                    />
                    <div className="w-5 shrink-0 flex justify-center">
                      {entry.geocoding === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {entry.geocoding === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {entry.geocoding === 'failed' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                    </div>
                    {entries.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeEntry(idx)} disabled={isSaving}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  {entry.geocoding === 'failed' && (
                    <div className="flex items-center gap-2 ml-7">
                      <span className="text-xs text-yellow-600">Coordenadas manuales:</span>
                      <Input
                        type="number"
                        step="0.000001"
                        placeholder="Lat"
                        value={entry.lat ?? ''}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          updateEntry(idx, { lat: isNaN(v) ? null : v });
                        }}
                        className="h-7 text-xs w-28"
                        disabled={isSaving}
                      />
                      <Input
                        type="number"
                        step="0.000001"
                        placeholder="Lng"
                        value={entry.lng ?? ''}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          updateEntry(idx, { lng: isNaN(v) ? null : v });
                        }}
                        className="h-7 text-xs w-28"
                        disabled={isSaving}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <Button variant="outline" size="sm" onClick={addEntry} disabled={isSaving} className="w-full">
            <Plus className="mr-1 h-3.5 w-3.5" /> Agregar dirección
          </Button>

          {isSaving && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{progressText}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSaving || isGeocoding}>
            {isSaving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>) : 'Crear Ruta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

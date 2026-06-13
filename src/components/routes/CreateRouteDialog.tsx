import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Upload, Loader2, CheckCircle, AlertCircle, RotateCcw, Plus, Trash2, Zap, ArrowRight } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useCreateRoute, useCreateRouteStops } from '@/hooks/useRoutes';
import { useUserCompany } from '@/hooks/useCompany';
import { geocodeAddress, geocodeSuggestions, type GeocodingSuggestion } from '@/services/geocoding';
import {
  optimizeStopOrder,
  calculateRouteDistanceKm,
  type StopCoordinate,
} from '@/services/routeOptimization';
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

function AddressAutocomplete({
  entry,
  index,
  disabled,
  onUpdate,
  onGeocode,
}: {
  entry: AddressEntry;
  index: number;
  disabled: boolean;
  onUpdate: (index: number, patch: Partial<AddressEntry>) => void;
  onGeocode: (index: number) => void;
}) {
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = useCallback((value: string) => {
    onUpdate(index, { address: value, geocoding: 'idle', lat: null, lng: null });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 3) {
      debounceRef.current = setTimeout(async () => {
        const results = await geocodeSuggestions(value);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      }, 500);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [index, onUpdate]);

  const handleSelect = (suggestion: GeocodingSuggestion) => {
    onUpdate(index, {
      address: suggestion.placeName,
      lat: suggestion.lat,
      lng: suggestion.lng,
      geocoding: 'success',
    });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <Input
        value={entry.address}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => {
          setTimeout(() => {
            if (!showSuggestions && entry.geocoding === 'idle' && entry.address.trim()) {
              onGeocode(index);
            }
          }, 200);
        }}
        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
        placeholder="Ej: Av. Larco 1301, Miraflores"
        disabled={disabled}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
            >
              <span className="font-medium">{s.text}</span>
              <span className="text-muted-foreground text-xs block truncate">{s.placeName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationSavingKm, setOptimizationSavingKm] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');

  const updateEntry = useCallback((index: number, patch: Partial<AddressEntry>) => {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, ...patch } : e));
    // Limpiar el ahorro calculado si el usuario modifica las paradas
    setOptimizationSavingKm(null);
  }, []);

  const handleGeocode = async (index: number) => {
    const addr = entries[index].address.trim();
    if (!addr) return;

    updateEntry(index, { geocoding: 'loading' });

    const result = await geocodeAddress(addr);

    if (result) {
      updateEntry(index, { lat: result.lat, lng: result.lng, geocoding: 'success' });
    } else {
      updateEntry(index, { geocoding: 'failed', lat: null, lng: null });
      toast({
        title: 'Dirección no encontrada',
        description: 'Intenta con más detalle, ej: "Av. Larco 1301, Miraflores, Lima".',
        variant: 'destructive',
      });
    }
  };

  const handleGeocodeAll = async () => {
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].address.trim() && entries[i].geocoding !== 'success') {
        await handleGeocode(i);
      }
    }
  };

  const geocodedEntries = entries.filter(e => e.geocoding === 'success' && e.lat && e.lng);
  const canOptimize = geocodedEntries.length >= 2 && !isOptimizing && !isSaving;

  const handleOptimize = async () => {
    if (!canOptimize) return;

    setIsOptimizing(true);
    setOptimizationSavingKm(null);

    try {
      const stopsForOsrm: StopCoordinate[] = entries
        .map((e, i) => ({ index: i, lat: e.lat!, lng: e.lng!, address_text: e.address }))
        .filter(s => s.lat != null && s.lng != null);

      const distanceBefore = calculateRouteDistanceKm(stopsForOsrm);
      const result = await optimizeStopOrder(stopsForOsrm, { fixedStart: true });

      // Reordenar entries según el orden optimizado
      setEntries(prev => {
        const reordered = result.optimizedOrder.map(origIdx => prev[origIdx]);
        return reordered;
      });

      const savingKm = distanceBefore - result.totalDistanceKm;
      setOptimizationSavingKm(savingKm);

      toast({
        title: '¡Ruta optimizada!',
        description: `Ahorro estimado: ${savingKm.toFixed(1)} km · Distancia total: ${result.totalDistanceKm.toFixed(1)} km · Tiempo: ~${Math.round(result.totalDurationMin)} min`,
      });
    } catch (err) {
      toast({
        title: 'Error al optimizar',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const addEntry = () => {
    setEntries(prev => [...prev, createEmptyEntry()]);
    setOptimizationSavingKm(null);
  };

  const removeEntry = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
    setOptimizationSavingKm(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      // Skip header row if first cell looks like a column name
      const firstCell = lines[0]?.split(',')[0]?.trim().toLowerCase() ?? '';
      const hasHeader = ['direccion', 'address', 'dirección', 'dir'].includes(firstCell);
      const dataLines = hasHeader ? lines.slice(1) : lines;
      setEntries(dataLines.map(line => {
        // Extract first CSV column as address
        const cols = line.split(',');
        const address = cols[0]?.trim() ?? line.trim();
        return { address, lat: null, lng: null, geocoding: 'idle' as const };
      }));
      setOptimizationSavingKm(null);
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
        description: `${invalidStops.length} parada(s) sin coordenadas válidas.`,
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
      setOptimizationSavingKm(null);
      onOpenChange(false);
      navigate(`/app/routes/${route.id}`);
    } catch (error) {
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
            Crea una nueva ruta de reparto. Escribe la dirección y selecciona de las sugerencias.
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
            <div className="flex gap-1 flex-wrap justify-end">
              {/* Botón Optimizar */}
              <Button
                variant={optimizationSavingKm !== null ? 'default' : 'outline'}
                size="sm"
                onClick={handleOptimize}
                disabled={!canOptimize}
                className={cn(
                  optimizationSavingKm !== null && 'bg-green-600 hover:bg-green-700 text-white'
                )}
              >
                {isOptimizing ? (
                  <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Optimizando...</>
                ) : optimizationSavingKm !== null ? (
                  <><CheckCircle className="mr-1 h-3.5 w-3.5" />Ahorro: {optimizationSavingKm.toFixed(1)} km</>
                ) : (
                  <><Zap className="mr-1 h-3.5 w-3.5" />Optimizar orden</>
                )}
              </Button>

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

          {/* Optimización tip */}
          {geocodedCount >= 2 && optimizationSavingKm === null && !isOptimizing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              <Zap className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
              <span>
                Tienes {geocodedCount} paradas listas. Usa <strong>Optimizar orden</strong> para minimizar la distancia total del recorrido.
              </span>
            </div>
          )}

          {/* Address entries */}
          <ScrollArea className="flex-1 max-h-[280px] pr-3">
            <div className="space-y-2">
              {entries.map((entry, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-5 text-right shrink-0 flex items-center justify-end gap-0.5">
                      {idx + 1}
                    </span>
                    <AddressAutocomplete
                      entry={entry}
                      index={idx}
                      disabled={isSaving}
                      onUpdate={updateEntry}
                      onGeocode={handleGeocode}
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
            {isSaving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
              : <><ArrowRight className="mr-2 h-4 w-4" />Crear Ruta</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

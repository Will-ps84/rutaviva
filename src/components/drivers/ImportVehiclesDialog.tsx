import { useState } from 'react';
import { Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useUserCompany } from '@/hooks/useCompany';
import { toast } from '@/hooks/use-toast';

interface ImportVehiclesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ImportVehiclesDialog({ open, onOpenChange, onImportComplete }: ImportVehiclesDialogProps) {
  const { data: company } = useUserCompany();
  const [textData, setTextData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);

  const handleImport = async () => {
    if (!textData.trim() || !company?.id) return;

    setIsImporting(true);
    setResults(null);

    try {
      const lines = textData.trim().split('\n').filter(l => l.trim());
      const vehicles = lines.map(line => {
        const [plate, label, year, capacity] = line.split('|').map(s => s.trim());
        return {
          company_id: company.id,
          plate: plate?.toUpperCase() || '',
          label: label || null,
          year: year ? parseInt(year) : null,
          capacity: capacity ? parseInt(capacity) : null,
        };
      });

      const validVehicles = vehicles.filter(v => v.plate);
      if (validVehicles.length === 0) {
        toast({ title: 'Error', description: 'No se encontraron placas válidas', variant: 'destructive' });
        setIsImporting(false);
        return;
      }

      const errors: string[] = [];
      let success = 0;

      // Insert one by one to catch individual errors
      for (const vehicle of validVehicles) {
        const { error } = await supabase.from('vehicles').insert(vehicle);
        if (error) {
          errors.push(`${vehicle.plate}: ${error.message}`);
        } else {
          success++;
        }
      }

      setResults({ success, errors });

      if (success > 0) {
        toast({
          title: `✅ ${success} vehículos importados`,
          description: errors.length > 0 ? `${errors.length} errores` : 'Sin errores',
        });
        onImportComplete();
      } else {
        toast({ title: 'No se importó ningún vehículo', variant: 'destructive' });
      }
    } catch (err) {
      toast({
        title: 'Error de importación',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setTextData('');
    setResults(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Vehículos
          </DialogTitle>
          <DialogDescription>
            Pega los datos de los vehículos, uno por línea
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-3 text-xs font-mono">
            <p className="text-muted-foreground mb-1 font-sans text-sm font-medium">Formato: Placa | Modelo | Año | Capacidad</p>
            <p>ABC-123 | Toyota Hiace | 2018 | 12</p>
            <p>DEF-456 | Hyundai H100 | 2020 | 10</p>
          </div>

          <Textarea
            placeholder="Pega tus datos aquí..."
            value={textData}
            onChange={(e) => setTextData(e.target.value)}
            rows={8}
            className="font-mono text-sm"
            disabled={isImporting}
          />

          {results && (
            <div className="space-y-2">
              {results.success > 0 && (
                <div className="flex items-center gap-2 text-sm text-status-active">
                  <CheckCircle2 className="h-4 w-4" />
                  {results.success} vehículos importados
                </div>
              )}
              {results.errors.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {results.errors.length} errores:
                  </div>
                  <div className="bg-destructive/10 rounded p-2 max-h-32 overflow-auto text-xs">
                    {results.errors.map((err, i) => (
                      <p key={i} className="text-destructive">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleImport} disabled={isImporting || !textData.trim()}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

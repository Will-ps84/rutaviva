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
import { toast } from '@/hooks/use-toast';

interface ImportDriversDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ImportDriversDialog({ open, onOpenChange, onImportComplete }: ImportDriversDialogProps) {
  const [textData, setTextData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);

  const handleImport = async () => {
    if (!textData.trim()) {
      toast({ title: 'Error', description: 'Pega los datos de los conductores', variant: 'destructive' });
      return;
    }

    setIsImporting(true);
    setResults(null);

    try {
      const lines = textData.trim().split('\n').filter(l => l.trim());
      const drivers = lines.map(line => {
        const [email, fullName, phone, license] = line.split('|').map(s => s.trim());
        return { email, full_name: fullName || '', phone: phone || '', license: license || '' };
      });

      const { data, error } = await supabase.functions.invoke('import-drivers', {
        body: { drivers },
      });

      if (error) throw error;

      setResults(data);
      
      if (data.success > 0) {
        toast({
          title: `✅ ${data.success} conductores importados`,
          description: data.errors.length > 0 ? `${data.errors.length} errores` : 'Sin errores',
        });
        onImportComplete();
      } else {
        toast({
          title: 'No se importó ningún conductor',
          description: 'Revisa los errores abajo',
          variant: 'destructive',
        });
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
            Importar Conductores
          </DialogTitle>
          <DialogDescription>
            Pega los datos de los conductores, uno por línea
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-3 text-xs font-mono">
            <p className="text-muted-foreground mb-1 font-sans text-sm font-medium">Formato: Email | Nombre | Teléfono | Licencia</p>
            <p>conductor1@email.com | Juan Pérez | +51987654321 | A-12345678</p>
            <p>conductor2@email.com | María López | +51912345678 | B-87654321</p>
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
                  {results.success} conductores importados
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

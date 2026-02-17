import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Camera, Loader2, CheckCircle2, SkipForward, XCircle } from 'lucide-react';
import { useCreateStopEvent } from '@/hooks/useStopEvents';
import { useUpdateStopStatus } from '@/hooks/useUpdateStopStatus';

interface StopActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop: {
    id: string;
    address_text: string;
    seq: number;
  } | null;
  action: 'done' | 'skipped' | 'failed';
  companyId: string;
  routeId: string;
  onCompleted?: () => void;
}

const actionConfig = {
  done: { label: 'Entregar', icon: CheckCircle2, className: 'bg-[hsl(var(--status-active))] hover:bg-[hsl(var(--status-active))]/90' },
  skipped: { label: 'Omitir', icon: SkipForward, className: 'bg-[hsl(var(--status-warning))] hover:bg-[hsl(var(--status-warning))]/90' },
  failed: { label: 'Marcar fallida', icon: XCircle, className: 'bg-destructive hover:bg-destructive/90' },
};

export function StopActionDialog({
  open,
  onOpenChange,
  stop,
  action,
  companyId,
  routeId,
  onCompleted,
}: StopActionDialogProps) {
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { mutate: updateStatus, isPending: statusPending } = useUpdateStopStatus();
  const { mutate: createEvent, isPending: eventPending } = useCreateStopEvent();
  const isPending = statusPending || eventPending;

  const cfg = actionConfig[action];

  const handleSubmit = () => {
    if (!stop) return;

    // 1. Update stop status
    updateStatus(
      { stopId: stop.id, status: action },
      {
        onSuccess: () => {
          // 2. Create stop event with note/evidence
          createEvent(
            {
              companyId,
              routeId,
              stopId: stop.id,
              eventType: action,
              note: note.trim() || undefined,
              evidenceFile: file || undefined,
            },
            {
              onSuccess: () => {
                setNote('');
                setFile(null);
                onOpenChange(false);
                onCompleted?.();
              },
            }
          );
        },
      }
    );
  };

  const handleClose = () => {
    if (!isPending) {
      setNote('');
      setFile(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <cfg.icon className="h-5 w-5" />
            {cfg.label} — Parada #{stop?.seq}
          </DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{stop?.address_text}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea
              id="note"
              placeholder="Ej: Cliente ausente, se dejó con vecino..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Evidencia (opcional)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              type="button"
            >
              <Camera className="h-4 w-4 mr-2" />
              {file ? file.name : 'Subir foto'}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className={`text-white ${cfg.className}`}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <cfg.icon className="h-4 w-4 mr-2" />
            )}
            {cfg.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Camera, Loader2, CheckCircle2, SkipForward, XCircle, Phone } from 'lucide-react';
import { useCreateStopEvent } from '@/hooks/useStopEvents';
import { useUpdateStopStatus } from '@/hooks/useUpdateStopStatus';

interface StopActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop: {
    id: string;
    address_text: string;
    seq: number;
    recipient_name?: string | null;
    recipient_phone?: string | null;
  } | null;
  action: 'done' | 'skipped' | 'failed';
  companyId: string;
  routeId: string;
  onCompleted?: () => void;
}

const actionConfig = {
  done: { label: 'Confirmar entrega', icon: CheckCircle2, className: 'bg-[hsl(var(--status-active))] hover:bg-[hsl(var(--status-active))]/90' },
  skipped: { label: 'Omitir parada', icon: SkipForward, className: 'bg-[hsl(var(--status-warning))] hover:bg-[hsl(var(--status-warning))]/90' },
  failed: { label: 'Marcar fallida', icon: XCircle, className: 'bg-destructive hover:bg-destructive/90' },
};

export function StopActionDialog({
  open, onOpenChange, stop, action, companyId, routeId, onCompleted,
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
    if (action === 'failed' && !note.trim()) {
      return; // require reason for failed
    }

    updateStatus(
      {
        stopId: stop.id,
        status: action,
        ...(action === 'failed' && note.trim() ? { failure_reason: note.trim() } : {}),
        ...(action === 'done' ? { completed_at: new Date().toISOString() } : {}),
      },
      {
        onSuccess: () => {
          createEvent(
            {
              companyId, routeId, stopId: stop.id,
              eventType: action,
              note: note.trim() || undefined,
              evidenceFile: file || undefined,
            },
            {
              onSuccess: () => {
                setNote(''); setFile(null);
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
    if (!isPending) { setNote(''); setFile(null); onOpenChange(false); }
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
          {stop?.recipient_name && (
            <p className="text-sm font-medium">{stop.recipient_name}</p>
          )}
          {stop?.recipient_phone && (
            <a
              href={`tel:${stop.recipient_phone}`}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Phone className="h-3 w-3" />
              {stop.recipient_phone}
            </a>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="note">
              {action === 'failed' ? 'Motivo (requerido)' : 'Nota (opcional)'}
            </Label>
            <Textarea
              id="note"
              placeholder={
                action === 'failed'
                  ? 'Ej: Cliente ausente, dirección incorrecta...'
                  : 'Ej: Se dejó con portería, firmó el cliente...'
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          {action === 'done' && (
            <div className="space-y-2">
              <Label>Foto de evidencia (opcional)</Label>
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
                {file ? file.name : 'Tomar foto o subir imagen'}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || (action === 'failed' && !note.trim())}
            className={`text-white ${cfg.className}`}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <cfg.icon className="h-4 w-4 mr-2" />}
            {cfg.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

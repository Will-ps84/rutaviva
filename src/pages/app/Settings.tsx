import { useState } from 'react';
import {
  Settings as SettingsIcon, Bell, MapPin, Clock, Wifi,
  Key, Plus, Trash2, Copy, Eye, EyeOff, MessageSquare,
  CheckCircle, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/useApiKeys';

// ── API Key Management ────────────────────────────────────────────────────────

function ApiKeySection() {
  const { data: keys = [], isLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<{ raw: string; name: string } | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    const result = await createKey.mutateAsync({ name: newKeyName.trim() });
    setRevealedKey({ raw: result.rawKey, name: newKeyName.trim() });
    setNewKeyName('');
    setShowCreate(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado ✓' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              API Keys de Integración
            </CardTitle>
            <CardDescription>
              Genera claves para integrar RutaViva con ERP, Shopify u otros sistemas externos.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Nueva API Key
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Endpoint de referencia */}
        <div className="bg-muted/50 rounded-md p-3 text-xs font-mono space-y-1">
          <p className="text-muted-foreground font-sans font-medium text-[11px] uppercase tracking-wide mb-1">Base URL</p>
          <p className="select-all break-all">https://mmkjgboukyfdhuvrdxdb.supabase.co/functions/v1/public-api</p>
          <p className="text-muted-foreground font-sans mt-1">Header: <span className="text-foreground">X-Api-Key: rv_live_...</span></p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando claves...</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No hay API Keys creadas aún.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Prefijo</TableHead>
                <TableHead className="text-center">Solicitudes</TableHead>
                <TableHead>Último uso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map(k => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.name}</TableCell>
                  <TableCell className="font-mono text-xs">{k.key_prefix}</TableCell>
                  <TableCell className="text-center">{k.request_count.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {k.last_used_at
                      ? format(new Date(k.last_used_at), 'dd MMM yyyy HH:mm', { locale: es })
                      : 'Nunca'}
                  </TableCell>
                  <TableCell>
                    {k.is_active
                      ? <Badge className="bg-emerald-500/10 text-emerald-700 text-xs">Activa</Badge>
                      : <Badge variant="secondary" className="text-xs">Revocada</Badge>}
                  </TableCell>
                  <TableCell>
                    {k.is_active && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setRevokeId(k.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Dialog: Crear nueva key */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva API Key</DialogTitle>
            <DialogDescription>
              Dale un nombre descriptivo para identificar qué sistema la usará.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Nombre de la integración</Label>
            <Input
              placeholder="ej: Shopify · ERP SAP · Sistema Propio"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newKeyName.trim() || createKey.isPending}>
              {createKey.isPending ? 'Generando...' : 'Generar clave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Mostrar clave generada */}
      <Dialog open={!!revealedKey} onOpenChange={() => setRevealedKey(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" /> API Key creada
            </DialogTitle>
            <DialogDescription>
              Copia esta clave ahora. <strong>No podrás verla de nuevo.</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Clave para: {revealedKey?.name}</Label>
            <div className="flex gap-2">
              <Input
                value={revealedKey?.raw ?? ''}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => handleCopy(revealedKey?.raw ?? '')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              Guarda esta clave en un lugar seguro. Almacenamos únicamente el hash — si la pierdes deberás crear una nueva.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)}>Listo, la guardé</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Revocar */}
      <AlertDialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar esta API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              Cualquier sistema que la esté usando dejará de tener acceso inmediatamente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (revokeId) { revokeKey.mutate(revokeId); setRevokeId(null); } }}
            >
              Revocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ── Twilio / Notificaciones ───────────────────────────────────────────────────

function TwilioSection() {
  const [showValues, setShowValues] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Notificaciones WhatsApp / SMS
        </CardTitle>
        <CardDescription>
          Configura Twilio para enviar notificaciones automáticas a destinatarios cuando el conductor llega o completa una entrega.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/50 rounded-md p-4 space-y-2 text-sm">
          <p className="font-medium">Cómo activar las notificaciones:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
            <li>Crea una cuenta en <strong>twilio.com</strong> (prueba gratis disponible)</li>
            <li>Activa WhatsApp Sandbox o un número aprobado de WhatsApp Business</li>
            <li>En <strong>Supabase Dashboard → Edge Functions → Secrets</strong>, agrega:</li>
          </ol>
          <div className="mt-2 font-mono text-xs bg-background border rounded p-3 space-y-1 select-all">
            <p>TWILIO_ACCOUNT_SID = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</p>
            <p>TWILIO_AUTH_TOKEN = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</p>
            <p>TWILIO_FROM_WHATSAPP = whatsapp:+14155238886</p>
            <p>TWILIO_FROM_SMS = +14155238886</p>
            <p>PUBLIC_APP_URL = https://tudominio.com</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="border rounded-lg p-4 space-y-1">
            <p className="font-medium flex items-center gap-2">📍 En camino</p>
            <p className="text-xs text-muted-foreground">Cuando el conductor marca "Llegué" en una parada</p>
            <Badge variant="secondary" className="text-xs">→ WhatsApp automático al destinatario</Badge>
          </div>
          <div className="border rounded-lg p-4 space-y-1">
            <p className="font-medium flex items-center gap-2">✅ Entregado</p>
            <p className="text-xs text-muted-foreground">Cuando la entrega se marca como completada</p>
            <Badge variant="secondary" className="text-xs">→ WhatsApp de confirmación</Badge>
          </div>
          <div className="border rounded-lg p-4 space-y-1">
            <p className="font-medium flex items-center gap-2">❌ Fallido</p>
            <p className="text-xs text-muted-foreground">Cuando la entrega falla con motivo</p>
            <Badge variant="secondary" className="text-xs">→ WhatsApp con motivo + contacto</Badge>
          </div>
          <div className="border rounded-lg p-4 space-y-1">
            <p className="font-medium flex items-center gap-2">📱 Requisito</p>
            <p className="text-xs text-muted-foreground">El stop debe tener <code>recipient_phone</code> en formato E.164</p>
            <Badge variant="secondary" className="text-xs">ej: +51987654321</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Settings Page ─────────────────────────────────────────────────────────────

export default function Settings() {
  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">
          Integraciones, alertas y parámetros de tracking
        </p>
      </div>

      {/* API Keys */}
      <ApiKeySection />

      {/* Twilio / Notificaciones */}
      <TwilioSection />

      {/* Alert thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Umbrales de Alertas
          </CardTitle>
          <CardDescription>
            Configura cuándo se generan alertas automáticas (próximamente guardado en la nube)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="stopped-time" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-status-warning" />
                Tiempo máximo parado (min)
              </Label>
              <Input id="stopped-time" type="number" defaultValue={10} min={1} className="max-w-[200px]" />
              <p className="text-xs text-muted-foreground">Alerta si el conductor está parado más de este tiempo</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stopped-radius" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-status-warning" />
                Radio de parada (metros)
              </Label>
              <Input id="stopped-radius" type="number" defaultValue={50} min={10} className="max-w-[200px]" />
              <p className="text-xs text-muted-foreground">Distancia para considerar que está en el mismo punto</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="off-route" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-status-danger" />
                Distancia fuera de ruta (metros)
              </Label>
              <Input id="off-route" type="number" defaultValue={500} min={100} className="max-w-[200px]" />
              <p className="text-xs text-muted-foreground">Alerta si se aleja más de esta distancia de la ruta</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="no-signal" className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-status-inactive" />
                TTL sin señal (min)
              </Label>
              <Input id="no-signal" type="number" defaultValue={5} min={1} className="max-w-[200px]" />
              <p className="text-xs text-muted-foreground">Alerta si no recibimos ubicación en este tiempo</p>
            </div>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button disabled>Guardar cambios</Button>
          </div>
        </CardContent>
      </Card>

      {/* Tracking settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Configuración de Tracking
          </CardTitle>
          <CardDescription>Parámetros de recolección de ubicación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tracking-interval" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Intervalo en movimiento (seg)
              </Label>
              <Input id="tracking-interval" type="number" defaultValue={10} min={5} className="max-w-[200px]" />
              <p className="text-xs text-muted-foreground">Frecuencia de envío cuando el conductor está en movimiento</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking-idle" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Intervalo parado (seg)
              </Label>
              <Input id="tracking-idle" type="number" defaultValue={60} min={30} className="max-w-[200px]" />
              <p className="text-xs text-muted-foreground">Frecuencia de envío cuando el conductor está parado</p>
            </div>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button disabled>Guardar cambios</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { AlertTriangle, Radio, CheckCircle2, XCircle, ChevronRight, ChevronLeft, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouteAlerts } from '@/hooks/useRouteAlerts';
import { formatDistanceToNow, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const alertIcons: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  long_stop: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-[hsl(var(--status-warning))]', label: 'Parada larga' },
  no_signal: { icon: <Radio className="h-4 w-4" />, color: 'text-[hsl(var(--status-danger))]', label: 'Sin señal' },
  route_completed: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-[hsl(var(--status-active))]', label: 'Ruta completada' },
  delivery_failed: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive', label: 'Entrega fallida' },
};

interface AlertsPanelProps {
  onFocusDriver?: (driverId: string) => void;
}

export function AlertsPanel({ onFocusDriver }: AlertsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { data: alerts = [] } = useRouteAlerts();

  const todayStart = startOfDay(new Date());
  const todayAlerts = alerts.filter(a => new Date(a.created_at!) >= todayStart);
  const activeCount = todayAlerts.filter(a => !a.is_read).length;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center">
        <Button
          variant="outline"
          size="icon"
          className="relative"
          onClick={() => setCollapsed(false)}
          title="Mostrar alertas"
        >
          <ChevronLeft className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full">
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 flex flex-col border border-border rounded-xl bg-card overflow-hidden shadow-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Alertas activas</span>
          {activeCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
              {activeCount}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCollapsed(true)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1 max-h-[420px]">
        {todayAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
            <BellOff className="h-7 w-7 opacity-40" />
            <p className="text-sm font-medium text-[hsl(var(--status-active))]">Todo en orden ✓</p>
            <p className="text-xs text-center">Sin alertas hoy</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {todayAlerts.map(alert => {
              const meta = alertIcons[alert.type] ?? alertIcons.no_signal;
              return (
                <button
                  key={alert.id}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start gap-3',
                    !alert.is_read && 'bg-primary/5'
                  )}
                  onClick={() => alert.driver_id && onFocusDriver?.(alert.driver_id)}
                >
                  <span className={cn('flex-shrink-0 mt-0.5', meta.color)}>
                    {meta.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{meta.label}</p>
                    <p className="text-sm leading-snug mt-0.5">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(alert.created_at!), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                  {!alert.is_read && (
                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

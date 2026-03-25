import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Radio, CheckCircle2, XCircle, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouteAlerts, useMarkAlertRead, useMarkAllAlertsRead } from '@/hooks/useRouteAlerts';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const alertIcons: Record<string, { icon: React.ReactNode; color: string }> = {
  long_stop: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-[hsl(var(--status-warning))]' },
  no_signal: { icon: <Radio className="h-4 w-4" />, color: 'text-[hsl(var(--status-danger))]' },
  route_completed: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-[hsl(var(--status-active))]' },
  delivery_failed: { icon: <XCircle className="h-4 w-4" />, color: 'text-destructive' },
};

export function AlertsBell() {
  const navigate = useNavigate();
  const { data: alerts = [] } = useRouteAlerts();
  const markRead = useMarkAlertRead();
  const markAllRead = useMarkAllAlertsRead();

  const unread = alerts.filter(a => !a.is_read).length;
  const badgeCount = unread > 9 ? '9+' : unread > 0 ? String(unread) : null;

  const handleAlertClick = (alert: typeof alerts[0]) => {
    if (!alert.is_read) markRead.mutate(alert.id);
    if (alert.route_id) navigate(`/app/routes/${alert.route_id}`);
    else if (alert.driver_id) navigate('/app');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {badgeCount && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full leading-none">
              {badgeCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm">Alertas</span>
          {unread > 0 && (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
              {unread} no leída{unread !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-[380px]">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <BellOff className="h-8 w-8 opacity-40" />
              <p className="text-sm">Sin alertas recientes</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {alerts.slice(0, 20).map((alert) => {
                const meta = alertIcons[alert.type] ?? alertIcons.no_signal;
                return (
                  <button
                    key={alert.id}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start gap-3',
                      !alert.is_read && 'bg-primary/5'
                    )}
                    onClick={() => handleAlertClick(alert)}
                  >
                    <span className={cn('flex-shrink-0 mt-0.5', meta.color)}>
                      {meta.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm leading-snug', !alert.is_read && 'font-medium')}>
                        {alert.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
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

        {/* Footer */}
        {unread > 0 && (
          <div className="border-t border-border px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllRead.mutate()}
            >
              Marcar todas como leídas
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

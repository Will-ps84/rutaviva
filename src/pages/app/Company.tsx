import { useState, useMemo } from 'react';
import { Building2, Users, Shield, UserCheck, UserX, Loader2, Trash2, Eye, EyeOff, Pencil, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserCompany } from '@/hooks/useCompany';
import { useCompanyMembers, useUpdateMemberStatus, useUpdateMemberRole } from '@/hooks/useCompanyMembers';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { CompanySetupCard } from '@/components/company/CompanySetupCard';
import { useCurrentUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  dispatcher: 'Despachador',
  driver: 'Conductor',
  viewer: 'Visor',
  owner: 'Propietario',
  super_admin: 'Super Admin',
};

const actionLabels: Record<string, string> = {
  role_created: 'Rol creado',
  role_updated: 'Rol actualizado',
  role_deleted: 'Rol eliminado',
  route_status_changed: 'Estado de ruta cambiado',
};

// Group members by user_id and aggregate roles
function groupMembers(members: ReturnType<typeof useCompanyMembers>['data']) {
  if (!members) return [];
  const map = new Map<string, {
    user_id: string;
    roles: string[];
    roleIds: string[];
    statuses: string[];
    primaryId: string;
    full_name: string | null;
    phone: string | null;
    created_at: string;
  }>();

  for (const m of members) {
    if (map.has(m.user_id)) {
      const existing = map.get(m.user_id)!;
      existing.roles.push(m.role);
      existing.roleIds.push(m.id);
      existing.statuses.push(m.status);
    } else {
      map.set(m.user_id, {
        user_id: m.user_id,
        roles: [m.role],
        roleIds: [m.id],
        statuses: [m.status],
        primaryId: m.id,
        full_name: m.full_name,
        phone: m.phone || null,
        created_at: m.created_at,
      });
    }
  }
  return Array.from(map.values());
}

export default function CompanyPage() {
  const { data: company, isLoading: companyLoading } = useUserCompany();
  const { data: members, isLoading: membersLoading } = useCompanyMembers();
  const { data: logs, isLoading: logsLoading } = useAuditLogs();
  const { data: currentRole } = useCurrentUserRole();
  const updateStatus = useUpdateMemberStatus();
  const updateRole = useUpdateMemberRole();
  const queryClient = useQueryClient();

  const [showNoName, setShowNoName] = useState(false);
  const [showOrphanModal, setShowOrphanModal] = useState(false);
  const [selectedOrphans, setSelectedOrphans] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);

  const isAdmin = currentRole?.role === 'admin' || currentRole?.role === 'owner' || currentRole?.role === 'super_admin';

  const grouped = useMemo(() => groupMembers(members), [members]);

  const visibleMembers = useMemo(() => {
    if (showNoName) return grouped;
    return grouped.filter(m => m.full_name && m.full_name.trim() !== '');
  }, [grouped, showNoName]);

  const orphanMembers = useMemo(
    () => grouped.filter(m => !m.full_name || m.full_name.trim() === ''),
    [grouped]
  );

  const handleDeleteOrphans = async () => {
    setDeletingIds(selectedOrphans);
    try {
      for (const roleId of selectedOrphans) {
        await supabase.from('user_roles').update({ status: 'deleted' }).eq('id', roleId);
      }
      queryClient.invalidateQueries({ queryKey: ['company-members'] });
      toast({ title: 'Usuarios limpiados', description: `${selectedOrphans.length} usuario(s) desactivados.` });
      setShowOrphanModal(false);
      setSelectedOrphans([]);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudieron eliminar algunos usuarios.', variant: 'destructive' });
    } finally {
      setDeletingIds([]);
    }
  };

function CompanySettingsCard({ company }: { company: any }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const qc = useQueryClient();

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('companies').update({ name: name.trim() }).eq('id', company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-company'] });
      setEditing(false);
      toast({ title: 'Empresa actualizada' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (!company) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Datos de la empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Nombre</Label>
            {editing ? (
              <Input value={name} onChange={e => setName(e.target.value)} className="mt-1" autoFocus />
            ) : (
              <p className="font-medium mt-1">{company.name}</p>
            )}
          </div>
          {editing ? (
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={() => update.mutate()} disabled={update.isPending || !name.trim()}>
                {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="mt-4" onClick={() => { setName(company.name); setEditing(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Plan: <span className="font-medium capitalize text-foreground">{company.plan_name || 'free'}</span></span>
          <span>ID: <span className="font-mono text-xs">{company.id.slice(0, 8)}…</span></span>
        </div>
      </CardContent>
    </Card>
  );
}


  if (!companyLoading && !company) return <CompanySetupCard />;

  const activeAdmins = members?.filter(m => ['admin', 'dispatcher', 'owner'].includes(m.role) && m.status === 'active').length || 0;
  const activeDrivers = members?.filter(m => m.role === 'driver' && m.status === 'active').length || 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          Mi Empresa
        </h1>
        <p className="text-muted-foreground">{company?.name}</p>
      </div>

      {/* Company settings */}
      <CompanySettingsCard company={company} />

      {/* Quotas */}
      <div className="grid gap-4 md:grid-cols-3">
        {companyLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-20" /></CardHeader><CardContent><Skeleton className="h-8 w-16" /></CardContent></Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Plan</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold capitalize">{company?.plan_name || 'free'}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />Admins
                </CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{activeAdmins} / {company?.max_admins ?? 2}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />Conductores
                </CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{activeDrivers} / {company?.max_drivers ?? 5}</div></CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Miembros</CardTitle>
              <CardDescription>Gestiona los usuarios de tu empresa</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch id="show-noname" checked={showNoName} onCheckedChange={setShowNoName} />
                <Label htmlFor="show-noname" className="text-sm cursor-pointer flex items-center gap-1.5">
                  {showNoName ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  Mostrar sin nombre
                </Label>
              </div>
              {isAdmin && orphanMembers.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowOrphanModal(true)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" />
                  Limpiar huérfanos ({orphanMembers.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : visibleMembers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleMembers.map((member) => {
                  const primaryStatus = member.statuses.includes('active') ? 'active' : member.statuses[0];
                  // Find matching raw member for mutation
                  const rawMember = members?.find(m => m.id === member.primaryId);
                  return (
                    <TableRow key={member.user_id}>
                      <TableCell className="font-medium">
                        {member.full_name || <span className="text-muted-foreground italic">Sin nombre</span>}
                        {member.phone && <span className="text-xs text-muted-foreground ml-2">{member.phone}</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {member.roles.map(role => (
                            <Badge key={role} variant="outline" className="text-xs">
                              {roleLabels[role] || role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={primaryStatus === 'active'
                          ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400'
                        }>
                          {primaryStatus === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {rawMember && (
                          primaryStatus === 'active' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => updateStatus.mutate({ roleId: rawMember.id, status: 'inactive' })}
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Desactivar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateStatus.mutate({ roleId: rawMember.id, status: 'active' })}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Activar
                            </Button>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No hay miembros registrados</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Registro de Actividad</CardTitle>
          <CardDescription>Últimas acciones en tu empresa</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <span className="text-sm font-medium">{actionLabels[log.action] || log.action}</span>
                    {log.details && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {(log.details as any).role && `Rol: ${roleLabels[(log.details as any).role] || (log.details as any).role}`}
                        {(log.details as any).route_name && `Ruta: ${(log.details as any).route_name}`}
                        {(log.details as any).new_status && ` → ${(log.details as any).new_status}`}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), 'dd MMM HH:mm', { locale: es })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Sin actividad registrada</p>
          )}
        </CardContent>
      </Card>

      {/* Orphan Users Modal */}
      <Dialog open={showOrphanModal} onOpenChange={setShowOrphanModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Usuarios sin nombre</DialogTitle>
            <DialogDescription>
              Selecciona los usuarios que deseas desactivar. Solo se cambia su estado — no se eliminan datos.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-72">
            <div className="space-y-2 pr-1">
              {orphanMembers.map(m => (
                <div key={m.user_id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Checkbox
                    id={m.primaryId}
                    checked={selectedOrphans.includes(m.primaryId)}
                    onCheckedChange={checked => {
                      setSelectedOrphans(prev =>
                        checked ? [...prev, m.primaryId] : prev.filter(id => id !== m.primaryId)
                      );
                    }}
                  />
                  <label htmlFor={m.primaryId} className="flex-1 cursor-pointer">
                    <p className="text-sm text-muted-foreground italic">Sin nombre</p>
                    <p className="text-xs text-muted-foreground">
                      Roles: {m.roles.map(r => roleLabels[r] || r).join(', ')} ·{' '}
                      Creado: {format(new Date(m.created_at), 'dd/MM/yyyy', { locale: es })}
                    </p>
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrphanModal(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={selectedOrphans.length === 0}
              onClick={() => setConfirmDelete(true)}
            >
              Desactivar seleccionados ({selectedOrphans.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Double confirm */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a desactivar {selectedOrphans.length} usuario(s). Esta acción cambia su estado pero no elimina datos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrphans} className="bg-destructive text-destructive-foreground">
              Confirmar desactivación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from 'react';
import { Building2, Users, Shield, UserCheck, UserX, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUserCompany } from '@/hooks/useCompany';
import { useCompanyMembers, useUpdateMemberStatus, useUpdateMemberRole } from '@/hooks/useCompanyMembers';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { CompanySetupCard } from '@/components/company/CompanySetupCard';
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

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-primary/10 text-primary border-primary/30',
  dispatcher: 'bg-accent/50 text-accent-foreground border-accent/30',
  driver: 'bg-secondary text-secondary-foreground border-secondary/30',
  viewer: 'bg-muted text-muted-foreground',
  owner: 'bg-primary/20 text-primary border-primary/40',
  super_admin: 'bg-destructive/10 text-destructive border-destructive/30',
};

const actionLabels: Record<string, string> = {
  role_created: 'Rol creado',
  role_updated: 'Rol actualizado',
  role_deleted: 'Rol eliminado',
  route_status_changed: 'Estado de ruta cambiado',
};

export default function CompanyPage() {
  const { data: company, isLoading: companyLoading } = useUserCompany();
  const { data: members, isLoading: membersLoading } = useCompanyMembers();
  const { data: logs, isLoading: logsLoading } = useAuditLogs();
  const updateStatus = useUpdateMemberStatus();
  const updateRole = useUpdateMemberRole();

  if (!companyLoading && !company) {
    return <CompanySetupCard />;
  }

  if (companyLoading || membersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

      {/* Quotas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{(company as any)?.plan_name || 'free'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAdmins} / {(company as any)?.max_admins || 2}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Conductores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDrivers} / {(company as any)?.max_drivers || 5}</div>
          </CardContent>
        </Card>
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Miembros</CardTitle>
          <CardDescription>Gestiona los usuarios de tu empresa</CardDescription>
        </CardHeader>
        <CardContent>
          {members && members.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.full_name || 'Sin nombre'}
                      {member.phone && <span className="text-xs text-muted-foreground ml-2">{member.phone}</span>}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onValueChange={(value) => updateRole.mutate({ roleId: member.id, role: value as any })}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="dispatcher">Despachador</SelectItem>
                          <SelectItem value="driver">Conductor</SelectItem>
                          <SelectItem value="viewer">Visor</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={member.status === 'active' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}>
                        {member.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {member.status === 'active' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => updateStatus.mutate({ roleId: member.id, status: 'inactive' })}
                        >
                          <UserX className="h-4 w-4 mr-1" />
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus.mutate({ roleId: member.id, status: 'active' })}
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Activar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No hay miembros registrados</p>
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
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <span className="text-sm font-medium">{actionLabels[log.action] || log.action}</span>
                    {log.details && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {log.details.role && `Rol: ${roleLabels[log.details.role as string] || log.details.role}`}
                        {log.details.route_name && `Ruta: ${log.details.route_name}`}
                        {log.details.new_status && ` → ${log.details.new_status}`}
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
    </div>
  );
}

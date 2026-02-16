import { useState } from 'react';
import { Shield, Building2, Users, Loader2, Edit, Save, X, ScrollText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAllCompanies, useUpdateCompanyPlan, CompanyWithPlan } from '@/hooks/useAllCompanies';
import { useAllAuditLogs } from '@/hooks/useAuditLogs';
import { useIsSuperAdmin } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const actionLabels: Record<string, string> = {
  role_created: 'Rol creado',
  role_updated: 'Rol actualizado',
  role_deleted: 'Rol eliminado',
  route_status_changed: 'Estado de ruta',
};

function EditCompanyRow({ company, onCancel }: { company: CompanyWithPlan; onCancel: () => void }) {
  const [planName, setPlanName] = useState(company.plan_name);
  const [maxAdmins, setMaxAdmins] = useState(company.max_admins);
  const [maxDrivers, setMaxDrivers] = useState(company.max_drivers);
  const [status, setStatus] = useState(company.status);
  const updatePlan = useUpdateCompanyPlan();

  const handleSave = () => {
    updatePlan.mutate(
      { companyId: company.id, updates: { plan_name: planName, max_admins: maxAdmins, max_drivers: maxDrivers, status } },
      { onSuccess: onCancel }
    );
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{company.name}</TableCell>
      <TableCell>
        <Input value={planName} onChange={(e) => setPlanName(e.target.value)} className="w-24 h-8" />
      </TableCell>
      <TableCell>
        <Input type="number" value={maxAdmins} onChange={(e) => setMaxAdmins(Number(e.target.value))} className="w-16 h-8" min={1} />
      </TableCell>
      <TableCell>
        <Input type="number" value={maxDrivers} onChange={(e) => setMaxDrivers(Number(e.target.value))} className="w-16 h-8" min={1} />
      </TableCell>
      <TableCell>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-24 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Activa</SelectItem>
            <SelectItem value="inactive">Inactiva</SelectItem>
            <SelectItem value="suspended">Suspendida</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={handleSave} disabled={updatePlan.isPending}>
            <Save className="h-4 w-4 text-primary" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function AdminPanel() {
  const isSuperAdmin = useIsSuperAdmin();
  const { data: companies, isLoading: companiesLoading } = useAllCompanies();
  const { data: logs, isLoading: logsLoading } = useAllAuditLogs();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!isSuperAdmin) {
    return <Navigate to="/app" replace />;
  }

  if (companiesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-destructive" />
          Panel Super Admin
        </h1>
        <p className="text-muted-foreground">Gestión global de empresas y cupos</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Empresas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companies?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {companies?.filter(c => c.status === 'active').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inactivas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {companies?.filter(c => c.status !== 'active').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies">
          <Card>
            <CardHeader>
              <CardTitle>Todas las Empresas</CardTitle>
              <CardDescription>Edita planes y cupos de cada empresa</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Max Admins</TableHead>
                    <TableHead>Max Conductores</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies?.map((company) =>
                    editingId === company.id ? (
                      <EditCompanyRow key={company.id} company={company} onCancel={() => setEditingId(null)} />
                    ) : (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{company.plan_name}</Badge>
                        </TableCell>
                        <TableCell>{company.max_admins}</TableCell>
                        <TableCell>{company.max_drivers}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={company.status === 'active' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}
                          >
                            {company.status === 'active' ? 'Activa' : company.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => setEditingId(company.id)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs Globales</CardTitle>
              <CardDescription>Últimas 200 acciones en todas las empresas</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : logs && logs.length > 0 ? (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{actionLabels[log.action] || log.action}</Badge>
                        {log.details?.route_name && <span className="text-muted-foreground">{log.details.route_name}</span>}
                        {log.details?.role && <span className="text-muted-foreground">({log.details.role})</span>}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), 'dd MMM HH:mm', { locale: es })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">Sin logs</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

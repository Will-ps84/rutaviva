import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Plus, 
  Route, 
  Eye, 
  Trash2, 
  Loader2,
  Calendar,
  MapPin,
  User,
  MoreVertical,
  Copy,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateRouteDialog } from '@/components/routes/CreateRouteDialog';
import { DuplicateRouteDialog } from '@/components/routes/DuplicateRouteDialog';
import { ResumeFailedDialog } from '@/components/routes/ResumeFailedDialog';
import { CompanySetupCard } from '@/components/company/CompanySetupCard';
import { useRoutes, useDeleteRoute, useRoute, useUpdateRoute } from '@/hooks/useRoutes';
import { useUserCompany } from '@/hooks/useCompany';

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  in_progress: 'En curso',
  done: 'Completada',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-muted',
  published: 'bg-primary/10 text-primary border-primary/30',
  in_progress: 'bg-[hsl(var(--status-warning))]/10 text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning))]/30',
  done: 'bg-[hsl(var(--status-active))]/10 text-[hsl(var(--status-active))] border-[hsl(var(--status-active))]/30',
};

// Skeleton row for table loading
function RouteSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
    </TableRow>
  );
}

// Inline hook to fetch stops for the duplicate/resume menu — only when needed
function RouteMenuActions({
  routeId,
  routeName,
  routeStatus,
  companyId,
  driverId,
  vehicleId,
  onView,
  onDelete,
}: {
  routeId: string;
  routeName: string;
  routeStatus: string;
  companyId: string;
  driverId: string | null;
  vehicleId: string | null;
  onView: () => void;
  onDelete: () => void;
}) {
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [needDetail, setNeedDetail] = useState(false);

  const { data: routeDetail } = useRoute(needDetail ? routeId : undefined);

  const failedCount = routeDetail?.route_stops?.filter(
    s => s.status === 'failed' || s.status === 'skipped'
  ).length ?? 0;

  const canResume = routeStatus === 'done' && failedCount > 0;

  const partialRoute = {
    id: routeId,
    name: routeName,
    status: routeStatus as any,
    company_id: companyId,
    driver_id: driverId,
    vehicle_id: vehicleId,
    date: '',
    created_at: '',
    updated_at: '',
    polyline: null,
    completed_at: null,
    started_at: null,
  };

  return (
    <>
      <DropdownMenu onOpenChange={open => { if (open) setNeedDetail(true); }}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onView}>
            <Eye className="mr-2 h-4 w-4" />
            Ver detalle
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowDuplicate(true)}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicar ruta
          </DropdownMenuItem>
          {canResume && (
            <DropdownMenuItem onClick={() => setShowResume(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reanudar entregas fallidas
            </DropdownMenuItem>
          )}
          {routeStatus === 'draft' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showDuplicate && (
        <DuplicateRouteDialog
          route={partialRoute as any}
          open={showDuplicate}
          onOpenChange={setShowDuplicate}
        />
      )}
      {showResume && routeDetail && (
        <ResumeFailedDialog
          route={routeDetail}
          open={showResume}
          onOpenChange={setShowResume}
        />
      )}
    </>
  );
}

export default function RoutesPage() {
  const navigate = useNavigate();
  const { data: company, isLoading: companyLoading } = useUserCompany();
  const { data: routes, isLoading } = useRoutes();
  const deleteRoute = useDeleteRoute();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteRouteId, setDeleteRouteId] = useState<string | null>(null);
  
  const handleDelete = () => {
    if (deleteRouteId) {
      deleteRoute.mutate(deleteRouteId);
      setDeleteRouteId(null);
    }
  };
  
  if (!companyLoading && !company) {
    return <CompanySetupCard />;
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Route className="h-6 w-6" />
            Rutas de Reparto
          </h1>
          <p className="text-muted-foreground">
            Crea y gestiona las rutas de entrega
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Ruta
        </Button>
      </div>
      
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {isLoading || companyLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-12" /></CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Rutas</CardTitle>
                <Route className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{routes?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Borradores</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {routes?.filter(r => r.status === 'draft').length || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent-foreground">
                  {routes?.filter(r => r.status === 'in_progress').length || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completadas</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-secondary-foreground">
                  {routes?.filter(r => r.status === 'done').length || 0}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      
      {/* Routes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Listado de Rutas</CardTitle>
          <CardDescription>Todas las rutas de reparto de tu empresa</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || companyLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Conductor</TableHead>
                  <TableHead className="text-center">Paradas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => <RouteSkeleton key={i} />)}
              </TableBody>
            </Table>
          ) : routes && routes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Conductor</TableHead>
                  <TableHead className="text-center">Paradas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell className="font-medium">{route.name}</TableCell>
                    <TableCell>
                      {format(new Date(route.date), 'd MMM yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      {route.driver?.full_name || (
                        <span className="text-muted-foreground">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {(route.route_stops as any)?.[0]?.count ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[route.status]}>
                        {statusLabels[route.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <RouteMenuActions
                        routeId={route.id}
                        routeName={route.name}
                        routeStatus={route.status}
                        companyId={route.company_id}
                        driverId={route.driver_id}
                        vehicleId={route.vehicle_id}
                        onView={() => navigate(`/app/routes/${route.id}`)}
                        onDelete={() => setDeleteRouteId(route.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Route className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Sin rutas creadas</h3>
              <p className="text-muted-foreground mb-6 max-w-xs mx-auto">
                Crea tu primera ruta de reparto y asigna paradas a tu conductor.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Ruta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      <CreateRouteDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      
      <AlertDialog open={!!deleteRouteId} onOpenChange={() => setDeleteRouteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta ruta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todas las paradas asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

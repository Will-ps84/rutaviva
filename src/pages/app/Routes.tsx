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
import { CreateRouteDialog } from '@/components/routes/CreateRouteDialog';
import { CompanySetupCard } from '@/components/company/CompanySetupCard';
import { useRoutes, useDeleteRoute } from '@/hooks/useRoutes';
import { useUserCompany } from '@/hooks/useCompany';

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicada',
  in_progress: 'En Progreso',
  done: 'Completada',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-primary/10 text-primary border-primary/30',
  in_progress: 'bg-accent/50 text-accent-foreground border-accent/30',
  done: 'bg-secondary text-secondary-foreground border-secondary/30',
};

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
  
  // Show company setup if no company
  if (!companyLoading && !company) {
    return <CompanySetupCard />;
  }
  
  if (isLoading || companyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
      </div>
      
      {/* Routes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Listado de Rutas</CardTitle>
          <CardDescription>
            Todas las rutas de reparto de tu empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          {routes && routes.length > 0 ? (
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
                        {route.route_stops?.[0]?.count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[route.status]}>
                        {statusLabels[route.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/app/routes/${route.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {route.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteRouteId(route.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Route className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay rutas</h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primera ruta de reparto para comenzar
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Ruta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Create Dialog */}
      <CreateRouteDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
      
      {/* Delete Confirmation */}
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Building2, Plus, Users, Loader2, Copy, CheckCircle2, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Company {
  id: string;
  name: string;
  plan_name: string | null;
  created_at: string;
  _count?: { users: number; routes: number };
}

function useIsSuperAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['is-super-admin', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });
}

function useCompanies() {
  return useQuery({
    queryKey: ['superadmin-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, plan_name, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Company[];
    },
  });
}

export default function SuperAdmin() {
  const { user } = useAuth();
  const { data: isSuperAdmin, isLoading: checkingRole } = useIsSuperAdmin();
  const { data: companies = [], isLoading } = useCompanies();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [plan, setPlan] = useState('free');
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string; company: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const createCompany = useMutation({
    mutationFn: async () => {
      // Everything done server-side to avoid triggering handle_company_created with auth.uid()
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-company-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          company_name: companyName.trim(),
          plan,
          full_name: adminName.trim(),
          email: adminEmail.trim().toLowerCase(),
          password: adminPassword,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error creando admin');
      return { company: companyName.trim(), email: adminEmail.trim(), password: adminPassword };
    },
    onSuccess: (creds) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-companies'] });
      setCreatedCreds(creds);
      setCompanyName(''); setAdminName(''); setAdminEmail(''); setAdminPassword(''); setPlan('free');
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleCopy = () => {
    if (!createdCreds) return;
    navigator.clipboard.writeText(`Empresa: ${createdCreds.company}\nEmail: ${createdCreds.email}\nContraseña: ${createdCreds.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (checkingRole) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isSuperAdmin) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Super Admin</h1>
              <p className="text-muted-foreground text-sm">Gestión de empresas en RutaViva</p>
            </div>
          </div>
          <Button onClick={() => { setCreateOpen(true); setCreatedCreds(null); }}>
            <Plus className="h-4 w-4 mr-2" /> Nueva Empresa
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{companies.length}</div>
              <p className="text-muted-foreground text-sm">Empresas totales</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{companies.filter(c => c.plan_name === 'pro').length}</div>
              <p className="text-muted-foreground text-sm">Plan Pro</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{companies.filter(c => c.plan_name === 'free' || !c.plan_name).length}</div>
              <p className="text-muted-foreground text-sm">Plan Free</p>
            </CardContent>
          </Card>
        </div>

        {/* Companies list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Empresas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : companies.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay empresas registradas</p>
            ) : (
              <div className="space-y-2">
                {companies.map(company => (
                  <div key={company.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{company.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Creada {format(new Date(company.created_at), "d MMM yyyy", { locale: es })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={company.plan_name === 'pro' ? 'default' : 'secondary'}>
                      {company.plan_name || 'free'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Company Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Empresa</DialogTitle>
            <CardDescription>Crea una empresa y su primer usuario administrador</CardDescription>
          </DialogHeader>

          {createdCreds ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">¡Empresa creada exitosamente!</span>
              </div>
              <div className="bg-muted rounded-lg p-4 space-y-2 font-mono text-sm">
                <p><span className="text-muted-foreground">Empresa:</span> {createdCreds.company}</p>
                <p><span className="text-muted-foreground">Email:</span> {createdCreds.email}</p>
                <p><span className="text-muted-foreground">Contraseña:</span> {createdCreds.password}</p>
              </div>
              <p className="text-xs text-muted-foreground">Copia estas credenciales y compártelas con el cliente. La contraseña no se volverá a mostrar.</p>
              <Button onClick={handleCopy} variant="outline" className="w-full">
                {copied ? <><CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />Copiado</> : <><Copy className="h-4 w-4 mr-2" />Copiar credenciales</>}
              </Button>
              <Button onClick={() => setCreateOpen(false)} className="w-full">Cerrar</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre de la empresa</Label>
                <Input placeholder="Ej: Distribuidora Lima SAC" value={companyName} onChange={e => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Administrador principal</p>
                <Input placeholder="Nombre completo" value={adminName} onChange={e => setAdminName(e.target.value)} />
                <Input placeholder="Email" type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
                <Input placeholder="Contraseña temporal (mín. 8 chars)" type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button
                  onClick={() => createCompany.mutate()}
                  disabled={createCompany.isPending || !companyName || !adminEmail || !adminPassword || adminPassword.length < 8}
                >
                  {createCompany.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</> : 'Crear empresa'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

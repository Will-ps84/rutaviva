import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCreateCompany } from '@/hooks/useCompany';

export function CompanySetupCard() {
  const [companyName, setCompanyName] = useState('');
  const [visibleError, setVisibleError] = useState<string | null>(null);
  const createCompany = useCreateCompany();
  const navigate = useNavigate();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVisibleError(null);
    
    if (companyName.trim()) {
      createCompany.mutate(companyName.trim(), {
        onError: (error) => {
          setVisibleError(error.message);
        },
        onSuccess: () => {
          setVisibleError(null);
          navigate('/app/routes');
        },
      });
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Configura tu empresa</CardTitle>
          <CardDescription>
            Para comenzar a usar RutaViva, primero necesitas crear tu empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Visible Error Display */}
            {visibleError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="text-sm break-all">
                  {visibleError}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="company-name">Nombre de la empresa</Label>
              <Input
                id="company-name"
                placeholder="Ej: Distribuidora Lima SAC"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={createCompany.isPending}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={!companyName.trim() || createCompany.isPending}
            >
              {createCompany.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Empresa'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

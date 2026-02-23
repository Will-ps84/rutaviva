import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Truck, ArrowLeft } from 'lucide-react';
import { driverLogin } from '@/services/driverAuth';

export default function DriverLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await driverLogin(phone, password);
      navigate('/driver', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <Link to="/choose-mode" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold">RutaViva</span>
        </div>

        <Card className="border-0 shadow-panel">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-2xl">Conductor</CardTitle>
            <CardDescription>Ingresa con tu teléfono y contraseña</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="driver-phone">Teléfono</Label>
                <Input
                  id="driver-phone"
                  type="tel"
                  placeholder="+51999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-password">Contraseña</Label>
                <Input
                  id="driver-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ingresando...</>
                ) : 'Iniciar sesión'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link to="/driver/activate" className="text-sm text-primary hover:underline">
                ¿Primera vez? Activa tu cuenta
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

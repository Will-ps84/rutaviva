import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Truck, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { activateDriver } from '@/services/driverAuth';

export default function DriverActivate() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await activateDriver(phone, code, newPassword);
      setSuccess(true);
      setTimeout(() => navigate('/driver/login', { replace: true }), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al activar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <Link to="/driver/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Volver al login
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold">RutaViva</span>
        </div>

        <Card className="border-0 shadow-panel">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-2xl">Activar cuenta</CardTitle>
            <CardDescription>
              Ingresa el código que te proporcionó tu administrador
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="h-12 w-12 text-[hsl(var(--status-active))] mx-auto" />
                <p className="font-semibold">¡Cuenta activada!</p>
                <p className="text-sm text-muted-foreground">Redirigiendo al login...</p>
              </div>
            ) : (
              <>
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="activate-phone">Teléfono</Label>
                    <Input
                      id="activate-phone"
                      type="tel"
                      placeholder="+51999999999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="activate-code">Código de activación</Label>
                    <Input
                      id="activate-code"
                      placeholder="ABC123"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="uppercase tracking-widest text-center font-mono text-lg"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="activate-password">Nueva contraseña</Label>
                    <Input
                      id="activate-password"
                      type="password"
                      placeholder="Mín. 10 chars, mayús., núm. y símbolo"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={10}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Activando...</>
                    ) : 'Activar cuenta'}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

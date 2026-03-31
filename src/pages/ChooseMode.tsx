import { useNavigate } from 'react-router-dom';
import { Truck, MapPin, Radio, CheckCircle2, BarChart3, Smartphone, Bell, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useRef } from 'react';

/* ─── Intersection-Observer fade-in ─── */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('opacity-100', 'translate-y-0'); el.classList.remove('opacity-0', 'translate-y-8'); obs.unobserve(el); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function FadeSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useFadeIn();
  return <div ref={ref} className={`opacity-0 translate-y-8 transition-all duration-700 ease-out ${className}`}>{children}</div>;
}

/* ─── Animated map mockup ─── */
function MapMockup() {
  const pins = [
    { x: 30, y: 25, delay: '0s', color: 'hsl(var(--status-active))' },
    { x: 65, y: 40, delay: '0.3s', color: 'hsl(var(--primary))' },
    { x: 45, y: 60, delay: '0.6s', color: 'hsl(var(--status-warning))' },
    { x: 75, y: 20, delay: '0.9s', color: 'hsl(var(--status-active))' },
    { x: 20, y: 55, delay: '1.2s', color: 'hsl(var(--primary))' },
  ];

  return (
    <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden border border-primary/20 shadow-2xl shadow-primary/10 bg-sidebar-accent">
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100" preserveAspectRatio="none">
        {[20,40,60,80].map(v => <line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} stroke="hsl(var(--primary))" strokeWidth="0.3"/>)}
        {[20,40,60,80].map(v => <line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" stroke="hsl(var(--primary))" strokeWidth="0.3"/>)}
      </svg>
      {/* Route line */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points="20,55 30,25 45,60 65,40 75,20" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.6"/>
      </svg>
      {/* Pins */}
      {pins.map((p, i) => (
        <div key={i} className="absolute animate-bounce" style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: p.delay, animationDuration: '2.5s' }}>
          <div className="w-4 h-4 rounded-full border-2 border-white/80 shadow-lg" style={{ backgroundColor: p.color }} />
        </div>
      ))}
      {/* Overlay label */}
      <div className="absolute bottom-3 left-3 bg-sidebar/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-[11px] text-sidebar-foreground/80 border border-sidebar-border">
        <span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--status-active))] mr-1.5 animate-pulse"/>3 conductores activos
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function ChooseMode() {
  const navigate = useNavigate();

  const metrics = [
    { icon: '🚚', value: '+500', label: 'Rutas optimizadas' },
    { icon: '📦', value: '98%', label: 'Entregas exitosas' },
    { icon: '⚡', value: '40%', label: 'Menos tiempo por ruta' },
    { icon: '📍', value: '24/7', label: 'Tracking GPS en tiempo real' },
  ];

  const benefits = [
    { icon: <MapPin className="h-7 w-7"/>, title: 'Rutas Inteligentes', desc: 'Asigna y optimiza rutas con un clic. Reduce kilómetros y tiempo de entrega.' },
    { icon: <Radio className="h-7 w-7"/>, title: 'GPS en Vivo', desc: 'Monitorea la ubicación exacta de cada conductor en tiempo real desde tu panel.' },
    { icon: <CheckCircle2 className="h-7 w-7"/>, title: 'Gestión de Paradas', desc: 'El conductor marca cada entrega al instante. Tú ves el progreso en vivo.' },
    { icon: <BarChart3 className="h-7 w-7"/>, title: 'Reportes Automáticos', desc: 'Historial completo de entregas, tiempos y rutas exportables.' },
    { icon: <Smartphone className="h-7 w-7"/>, title: 'App Móvil para Conductores', desc: 'Interfaz simple y rápida, funciona sin internet intermitente.' },
    { icon: <Bell className="h-7 w-7"/>, title: 'Alertas Inteligentes', desc: 'Recibe avisos si un conductor lleva más de 15 min sin movimiento.' },
  ];

  const steps = [
    { num: '01', title: 'Crea la ruta', desc: 'El admin sube las direcciones de entrega' },
    { num: '02', title: 'Asigna al conductor', desc: 'El conductor recibe la ruta en su app móvil' },
    { num: '03', title: 'Monitorea en vivo', desc: 'Tracking GPS + confirmación de cada parada' },
  ];

  return (
    <div className="min-h-screen bg-sidebar-background text-sidebar-foreground overflow-x-hidden">

      {/* ── Header ── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-sidebar-background/70 backdrop-blur-xl border-b border-sidebar-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">RutaViva</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary" onClick={() => navigate('/admin/login')}>
              Administrador
            </Button>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => navigate('/driver/login')}>
              Conductor
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center pt-16">
        <div className="absolute inset-0 bg-gradient-hero" />
        {/* subtle radial glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none"/>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 w-full grid lg:grid-cols-2 gap-12 items-center py-20">
          <FadeSection>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              Gestiona tus rutas de entrega{' '}
              <span className="text-gradient-primary">en tiempo real</span>
            </h1>
            <p className="mt-5 text-lg text-sidebar-foreground/60 max-w-lg leading-relaxed">
              Optimiza cada ruta, monitorea a tus conductores y entrega más rápido con RutaViva.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-[48px] gap-2" onClick={() => navigate('/admin/login')}>
                Comenzar como Administrador <ArrowRight className="h-4 w-4"/>
              </Button>
              <Button size="lg" variant="outline" className="border-sidebar-foreground/30 text-sidebar-foreground hover:bg-sidebar-accent min-h-[48px]" onClick={() => navigate('/driver/login')}>
                Acceso Conductor
              </Button>
            </div>
          </FadeSection>

          <FadeSection className="flex justify-center lg:justify-end">
            <MapMockup />
          </FadeSection>
        </div>
      </section>

      {/* ── Metrics ── */}
      <section className="relative bg-sidebar-accent/50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <FadeSection>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {metrics.map((m, i) => (
                <div key={i} className="rounded-xl border border-primary/15 bg-sidebar-accent p-6 text-center hover:border-primary/30 transition-colors">
                  <span className="text-3xl">{m.icon}</span>
                  <p className="font-display text-3xl sm:text-4xl font-bold mt-3 text-primary">{m.value}</p>
                  <p className="text-sm text-sidebar-foreground/50 mt-1">{m.label}</p>
                </div>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="py-20 bg-sidebar-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <FadeSection className="text-center mb-14">
            <h2 className="font-display text-3xl sm:text-4xl font-bold">¿Por qué elegir <span className="text-gradient-primary">RutaViva</span>?</h2>
          </FadeSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b, i) => (
              <FadeSection key={i}>
                <div className="rounded-xl border border-sidebar-border bg-sidebar-accent p-6 h-full hover:border-primary/30 transition-colors group">
                  <div className="w-12 h-12 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-4 group-hover:bg-primary/25 transition-colors">
                    {b.icon}
                  </div>
                  <h3 className="font-display text-lg font-semibold mb-2">{b.title}</h3>
                  <p className="text-sm text-sidebar-foreground/55 leading-relaxed">{b.desc}</p>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 bg-sidebar-accent/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <FadeSection className="text-center mb-14">
            <h2 className="font-display text-3xl sm:text-4xl font-bold">Cómo funciona</h2>
          </FadeSection>
          <FadeSection>
            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connector line (desktop) */}
              <div className="hidden md:block absolute top-10 left-[16.6%] right-[16.6%] h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40"/>
              {steps.map((s, i) => (
                <div key={i} className="text-center relative">
                  <div className="w-20 h-20 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center mx-auto relative z-10 bg-sidebar-accent">
                    <span className="font-display text-2xl font-bold text-primary">{s.num}</span>
                  </div>
                  <h3 className="font-display text-xl font-semibold mt-5">{s.title}</h3>
                  <p className="text-sm text-sidebar-foreground/55 mt-2 max-w-xs mx-auto">{s.desc}</p>
                </div>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-sidebar-background">
        <FadeSection className="text-center max-w-2xl mx-auto px-4">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">¿Listo para optimizar tus entregas?</h2>
          <p className="text-sidebar-foreground/55 mb-8">Empieza a gestionar tus rutas hoy mismo con RutaViva.</p>
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-[48px] gap-2" onClick={() => navigate('/admin/login')}>
            Comenzar ahora <ArrowRight className="h-4 w-4"/>
          </Button>
        </FadeSection>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-sidebar-background border-t border-sidebar-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Truck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-sm font-semibold">RutaViva</span>
          </div>
          <p className="text-sidebar-foreground/30 text-xs">© {new Date().getFullYear()} RutaViva. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

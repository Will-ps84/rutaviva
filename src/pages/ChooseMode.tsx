import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Truck, MapPin, Radio, CheckCircle2, BarChart3, Smartphone, AlertTriangle, ArrowRight } from 'lucide-react';

/* ─── Fade-in on scroll ─── */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('opacity-100', 'translate-y-0'); obs.unobserve(el); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Fade({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useFadeIn();
  return <div ref={ref} className={`opacity-0 translate-y-8 transition-all duration-700 ease-out ${className}`}>{children}</div>;
}

/* ─── Dispatch mockup card ─── */
function DispatchMockup() {
  const drivers = [
    { color: 'bg-emerald-400', name: 'Carlos M.', status: 'En ruta', statusColor: 'bg-emerald-500/20 text-emerald-400', dist: '2.3km restantes' },
    { color: 'bg-amber-400', name: 'Pedro R.', status: 'Próxima parada', statusColor: 'bg-amber-500/20 text-amber-400', dist: '5.1km restantes' },
    { color: 'bg-sky-400', name: 'Ana G.', status: 'Completado', statusColor: 'bg-sky-500/20 text-sky-400', dist: '✓ 8/8 paradas' },
  ];

  return (
    <div className="relative w-full max-w-lg">
      {/* Main card */}
      <div className="bg-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Panel en Vivo</span>
            <span className="text-slate-400 text-sm">• 3 rutas activas</span>
          </div>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        </div>

        {/* Driver rows */}
        <div className="space-y-3">
          {drivers.map((d, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate-700/40 rounded-lg px-3 py-2.5">
              <div className={`w-8 h-8 rounded-full ${d.color} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{d.name}</p>
                <p className="text-xs text-slate-400">{d.dist}</p>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${d.statusColor}`}>{d.status}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400">Entregas del día</span>
            <span className="text-teal-400 font-semibold">67% completado</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className="bg-teal-500 h-2 rounded-full transition-all duration-1000" style={{ width: '67%' }} />
          </div>
        </div>
      </div>

      {/* Overlay card */}
      <div className="absolute -bottom-4 -right-2 sm:-right-6 bg-slate-800 rounded-xl shadow-xl p-3.5 border border-slate-700 w-56">
        <div className="flex items-center gap-1.5 mb-1">
          <MapPin className="h-3.5 w-3.5 text-teal-400" />
          <span className="text-[11px] font-semibold text-white">Última entrega confirmada</span>
        </div>
        <p className="text-xs text-slate-300">Jr. Lampa 432, Lima Centro</p>
        <p className="text-[11px] text-slate-500 mt-1">Hace 2 min • ✅ Entregado</p>
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function ChooseMode() {
  const navigate = useNavigate();

  const benefits = [
    { icon: <MapPin className="h-6 w-6" />, title: 'Rutas Inteligentes', desc: 'Crea y asigna rutas con un clic. Menos kilómetros, más entregas.' },
    { icon: <Radio className="h-6 w-6" />, title: 'GPS en Vivo', desc: 'Ve en el mapa dónde está cada conductor en este momento.' },
    { icon: <CheckCircle2 className="h-6 w-6" />, title: 'Confirmación Instantánea', desc: 'El conductor marca la entrega. Tú ves el estado al instante.' },
    { icon: <BarChart3 className="h-6 w-6" />, title: 'Reportes Completos', desc: 'Historial de entregas, tiempos y rutas. Exporta cuando quieras.' },
    { icon: <Smartphone className="h-6 w-6" />, title: 'App para Conductor', desc: 'Interfaz simple y rápida. Funciona incluso con señal débil.' },
    { icon: <AlertTriangle className="h-6 w-6" />, title: 'Alertas de Inactividad', desc: 'Aviso automático si un conductor lleva +15 min sin moverse.' },
  ];

  const steps = [
    { num: '1', title: 'Crea la ruta', desc: 'Sube las direcciones de entrega en el panel admin' },
    { num: '2', title: 'Asigna al conductor', desc: 'El chofer recibe su ruta en la app móvil' },
    { num: '3', title: 'Monitorea en vivo', desc: 'GPS + confirmación de cada parada en tiempo real' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white overflow-x-hidden">

      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
              <Truck className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">RutaViva</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/admin/login')} className="px-3.5 py-1.5 text-sm font-medium rounded-lg border border-teal-400 text-teal-400 hover:bg-teal-400 hover:text-white transition-colors">
              Admin
            </button>
            <button onClick={() => navigate('/driver/login')} className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-teal-500 text-white hover:bg-teal-400 transition-colors">
              Conductor
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center pt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-16 sm:py-20">
          {/* Left */}
          <Fade>
            <span className="inline-block bg-teal-500/10 text-teal-400 text-sm font-medium px-4 py-1.5 rounded-full border border-teal-500/20 mb-6">
              🚀 Plataforma N°1 de Despacho en Lima
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight">
              Controla cada entrega{' '}
              <span className="text-teal-400">en tiempo real</span>
            </h1>
            <p className="mt-5 text-lg text-slate-400 max-w-lg leading-relaxed">
              Asigna rutas, rastrea conductores con GPS y confirma entregas al instante. Todo desde un solo panel.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => navigate('/admin/login')} className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold px-6 py-3 rounded-xl text-base transition-colors min-h-[48px]">
                Ingresar como Admin <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => navigate('/driver/login')} className="inline-flex items-center gap-2 border border-slate-500 hover:border-white text-white font-medium px-6 py-3 rounded-xl text-base transition-colors min-h-[48px]">
                Soy Conductor
              </button>
            </div>
            {/* Stats */}
            <div className="mt-10 flex flex-wrap gap-6 sm:gap-10">
              {[['500+', 'rutas'], ['98%', 'entregas exitosas'], ['40%', 'más rápido']].map(([val, label], i) => (
                <div key={i}>
                  <p className="text-2xl font-bold text-white">{val}</p>
                  <p className="text-sm text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </Fade>

          {/* Right */}
          <Fade className="flex justify-center lg:justify-end">
            <DispatchMockup />
          </Fade>
        </div>
      </section>

      {/* ── Metrics ── */}
      <section className="bg-teal-600 py-14 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Fade>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 text-center">
              {[
                ['🚚', '500+', 'Rutas optimizadas'],
                ['📦', '98%', 'Entregas exitosas'],
                ['⚡', '40%', 'Reducción de tiempo'],
                ['📍', '24/7', 'Tracking GPS activo'],
              ].map(([icon, value, label], i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-5 sm:p-6">
                  <span className="text-2xl">{icon}</span>
                  <p className="text-3xl sm:text-4xl font-bold mt-2 text-white">{value}</p>
                  <p className="text-sm text-teal-100 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </Fade>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="bg-slate-800 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Fade className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">¿Por qué elegir <span className="text-teal-400">RutaViva</span>?</h2>
          </Fade>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {benefits.map((b, i) => (
              <Fade key={i}>
                <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-6 h-full hover:border-teal-500 transition-colors group">
                  <div className="w-11 h-11 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center mb-4 group-hover:bg-teal-500/25 transition-colors">
                    {b.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{b.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{b.desc}</p>
                </div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-slate-900 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Fade className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold">Empieza a entregar mejor hoy</h2>
          </Fade>
          <Fade>
            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connector line (desktop) */}
              <div className="hidden md:block absolute top-10 left-[16.6%] right-[16.6%] h-0.5 bg-gradient-to-r from-teal-500/40 via-teal-500 to-teal-500/40" />
              {steps.map((s, i) => (
                <div key={i} className="text-center relative">
                  <div className="w-20 h-20 rounded-full bg-teal-500/15 border-2 border-teal-500/40 flex items-center justify-center mx-auto relative z-10 bg-slate-900">
                    <span className="text-2xl font-bold text-teal-400">{s.num}</span>
                  </div>
                  <h3 className="text-xl font-semibold mt-5">{s.title}</h3>
                  <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">{s.desc}</p>
                </div>
              ))}
            </div>
          </Fade>
          {/* Final CTA */}
          <Fade className="text-center mt-14">
            <button onClick={() => navigate('/admin/login')} className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold px-12 py-4 rounded-full text-lg transition-colors min-h-[48px]">
              Comenzar ahora <ArrowRight className="h-5 w-5" />
            </button>
          </Fade>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-teal-500 flex items-center justify-center">
              <Truck className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold">RutaViva</span>
          </div>
          <p className="text-slate-500 text-xs">© {new Date().getFullYear()} RutaViva. Todos los derechos reservados.</p>
          <p className="text-slate-600 text-xs">Hecho con ❤️ para empresas de reparto en Lima, Perú</p>
        </div>
      </footer>
    </div>
  );
}

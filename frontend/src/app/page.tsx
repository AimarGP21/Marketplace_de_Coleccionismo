import { COLLECTIBLE_ITEMS } from '@/data/collectibles';
import CollectibleCard from '@/components/CollectibleCard';
import { Shield, CreditCard, Sparkles, Lock } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(217,119,6,0.15),rgba(255,255,255,0))] pointer-events-none" />
        
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Coleccionismo de Alto Nivel &bull; Pagos Seguros con Stripe</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto">
          Adquiere piezas de colección con la máxima{' '}
          <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
            seguridad y autenticidad
          </span>
        </h1>

        <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
          Cartas certificadas, cómics clásicos y numismática de grado museo. Checkout integrado directamente con Stripe Sandbox Elements y microservicio en FastAPI.
        </p>

        {/* Feature Badges */}
        <div className="mt-8 flex flex-wrap justify-center gap-6 text-xs text-slate-300 font-medium">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Encriptación de Extremo a Extremo</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-400" />
            <span>Stripe Payment Element Oficial</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>Sandbox Mode Activo</span>
          </div>
        </div>
      </section>

      {/* Grid de Coleccionables */}
      <section className="space-y-6">
        <div className="flex items-end justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Artículos Destacados</h2>
            <p className="text-sm text-slate-400 mt-1">Selecciona cualquier pieza para probar el flujo de checkout interactivo.</p>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            {COLLECTIBLE_ITEMS.length} piezas disponibles
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {COLLECTIBLE_ITEMS.map((item) => (
            <CollectibleCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

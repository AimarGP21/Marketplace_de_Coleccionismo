'use client';

import { Suspense, useState, use } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COLLECTIBLE_ITEMS } from '@/data/collectibles';
import AlternativeCheckout from '@/components/AlternativeCheckout';
import StripeCheckout from '@/components/StripeCheckout';
import { ArrowLeft, ShieldCheck, PackageCheck, QrCode, CreditCard } from 'lucide-react';

interface CheckoutPageProps {
  searchParams: Promise<{ id?: string }>;
}

function CheckoutContent({ searchParams }: CheckoutPageProps) {
  const resolvedParams = use(searchParams);
  const itemId = resolvedParams.id || COLLECTIBLE_ITEMS[0].id;
  const item = COLLECTIBLE_ITEMS.find((c) => c.id === itemId);

  const [activeMode, setActiveMode] = useState<'alternative' | 'stripe'>('alternative');

  if (!item) {
    return notFound();
  }

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: item.currency.toUpperCase(),
  }).format(item.price);

  return (
    <div className="space-y-8">
      {/* Barra superior de navegación */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a la colección</span>
        </Link>

        {/* Selector de Experiencia de Checkout */}
        <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveMode('alternative')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeMode === 'alternative'
                ? 'bg-amber-400 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Métodos Alternativos (QR / BNPL)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('stripe')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeMode === 'stripe'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Stripe Tarjeta Clásica</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Resumen del Artículo Coleccionable (Columna Izquierda) */}
        <div className="lg:col-span-5 bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Resumen de la Orden
            </span>
            <span className="text-xs text-slate-400">ID: {item.id}</span>
          </div>

          <div className="flex gap-4 items-center">
            <div className="relative w-24 h-24 rounded-xl bg-slate-950 p-2 border border-slate-800 shrink-0 flex items-center justify-center">
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider block">
                {item.category}
              </span>
              <h2 className="text-base font-bold text-white line-clamp-2">
                {item.title}
              </h2>
              <span className="inline-block mt-1 text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                {item.condition}
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-800 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal del artículo</span>
              <span className="text-slate-200">{formattedPrice}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Envío asegurado con seguimiento</span>
              <span className="text-emerald-400 font-medium">Gratis (Incluido)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Certificado de autenticidad</span>
              <span className="text-emerald-400 font-medium">Incluido</span>
            </div>
            <div className="flex justify-between text-base font-bold text-white pt-3 border-t border-slate-800">
              <span>Total a pagar</span>
              <span className="text-xl text-amber-400">{formattedPrice}</span>
            </div>
          </div>

          {/* Garantías del Marketplace */}
          <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800/80 space-y-3 text-xs text-slate-300">
            <div className="flex items-center gap-2.5 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Protección al Comprador RelicVault</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              El pago se retiene de forma segura hasta que recibas y verifiques la autenticidad física de tu coleccionable.
            </p>
            <div className="flex items-center gap-2 text-slate-400">
              <PackageCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Vendido por: <strong className="text-slate-200">{item.seller.name}</strong> ({item.seller.rating}★)</span>
            </div>
          </div>
        </div>

        {/* Experiencia de Checkout Seleccionada (Columna Derecha) */}
        <div className="lg:col-span-7 bg-slate-900/60 rounded-2xl border border-slate-800 p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-white">
              {activeMode === 'alternative'
                ? 'Checkout con Métodos Alternativos'
                : 'Finalizar Compra con Stripe'}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {activeMode === 'alternative'
                ? 'Flujo paso a paso con microservicio FastAPI: QR dinámico, Paga Después (BNPL) y gestión de errores.'
                : 'Pasarela en modo de prueba conectada con Stripe Elements.'}
            </p>
          </div>

          {activeMode === 'alternative' ? (
            <AlternativeCheckout item={item} />
          ) : (
            <StripeCheckout item={item} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage(props: CheckoutPageProps) {
  return (
    <Suspense fallback={<div className="text-center py-20 text-slate-400">Cargando detalles del coleccionable...</div>}>
      <CheckoutContent {...props} />
    </Suspense>
  );
}

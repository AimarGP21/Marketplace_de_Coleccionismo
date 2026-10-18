'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ShieldCheck, ArrowRight, Loader2, PackageCheck, AlertCircle } from 'lucide-react';
import { getPaymentStatus } from '@/services/api';
import { PaymentStatusResponse } from '@/types';
import { COLLECTIBLE_ITEMS } from '@/data/collectibles';

function SuccessContent() {
  const searchParams = useSearchParams();
  const paymentIntentId = searchParams.get('payment_intent');
  const itemId = searchParams.get('item_id');

  const [paymentData, setPaymentData] = useState<PaymentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const item = COLLECTIBLE_ITEMS.find((c) => c.id === itemId);

  useEffect(() => {
    if (!paymentIntentId) {
      setLoading(false);
      return;
    }

    async function fetchStatus() {
      try {
        const data = await getPaymentStatus(paymentIntentId!);
        setPaymentData(data);
      } catch (err: any) {
        console.error('Error al consultar estado de pago:', err);
        setError(err.message || 'No se pudo verificar el estado en la API.');
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, [paymentIntentId]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
        <h2 className="text-xl font-bold text-white">Verificando transacción en Stripe Sandbox...</h2>
        <p className="text-sm text-slate-400">Consultando estado con el microservicio Payments API</p>
      </div>
    );
  }

  const isSuccess = paymentData?.status === 'succeeded' || !error;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 sm:p-10 text-center space-y-8 shadow-2xl">
        {/* Icono de Exito */}
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
            Pago Confirmado con Éxito
          </span>
          <h1 className="text-3xl font-extrabold text-white mt-4">
            ¡Felicidades por tu nueva pieza de colección!
          </h1>
          <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
            La transacción fue procesada en modo Sandbox y el vendedor ha recibido la notificación para preparar el envío asegurado.
          </p>
        </div>

        {/* Resumen del coleccionable comprado */}
        {item && (
          <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-4 flex items-center gap-4 text-left">
            <img
              src={item.image}
              alt={item.title}
              className="w-16 h-16 object-contain rounded-lg bg-slate-900 p-1 border border-slate-800 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block">
                {item.category}
              </span>
              <h3 className="text-sm font-bold text-white truncate">{item.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{item.condition}</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-amber-400">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency.toUpperCase() }).format(item.price)}
              </span>
            </div>
          </div>
        )}

        {/* Detalles de la Transaccion Stripe */}
        <div className="bg-slate-950/50 rounded-2xl border border-slate-800/80 p-5 text-left text-xs space-y-2.5">
          <div className="flex justify-between items-center text-slate-400">
            <span>Stripe Payment Intent ID:</span>
            <code className="text-amber-300 font-mono text-[11px] bg-slate-900 px-2 py-0.5 rounded">
              {paymentIntentId || 'N/A'}
            </code>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Estado del Pago:</span>
            <span className="text-emerald-400 font-bold uppercase">
              {paymentData?.status || 'succeeded'}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Entorno:</span>
            <span className="text-slate-300 font-medium">Stripe Testmode (Sandbox)</span>
          </div>
          {paymentData?.receipt_url && (
            <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center">
              <span>Recibo oficial de Stripe:</span>
              <a
                href={paymentData.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline"
              >
                Ver recibo
              </a>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all"
          >
            <span>Explorar más coleccionables</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="text-center py-24 text-slate-400">Cargando confirmación...</div>}>
      <SuccessContent />
    </Suspense>
  );
}

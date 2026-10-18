'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { CollectibleItem } from '@/types';
import { createPaymentIntent } from '@/services/api';
import { ShieldCheck, AlertCircle, Loader2, CreditCard, Sparkles, CheckCircle2 } from 'lucide-react';

// Inicializar el SDK oficial de Stripe en el cliente
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface StripeCheckoutProps {
  item: CollectibleItem;
}

function CheckoutForm({ item }: { item: CollectibleItem }) {
  const stripe = useStripe();
  const elements = useElements();

  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const returnUrl = `${origin}/success?item_id=${item.id}`;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        receipt_email: email || undefined,
      },
    });

    // Este punto solo se alcanza si hay un error inmediato (ej. tarjeta rechazada)
    if (error) {
      if (error.type === 'card_error' || error.type === 'validation_error') {
        setErrorMessage(error.message || 'Error con los datos de la tarjeta.');
      } else {
        setErrorMessage('Ocurrió un error inesperado al procesar el pago.');
      }
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informacion de Comprador */}
      <div>
        <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
          Correo Electrónico para Recibo y Certificado
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="coleccionista@ejemplo.com"
          className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm transition-all"
        />
      </div>

      {/* Stripe Payment Element Oficial */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
          Método de Pago Seguro (Stripe Sandbox)
        </label>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <PaymentElement
            options={{
              layout: 'tabs',
            }}
          />
        </div>
      </div>

      {/* Caja de ayuda para tarjetas de prueba en Sandbox */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-amber-300">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Datos para prueba en Stripe Sandbox</span>
        </div>
        <p className="text-slate-300">
          Usa la tarjeta de prueba estándar: <code className="bg-slate-900 px-2 py-0.5 rounded text-amber-400 font-mono">4242 4242 4242 4242</code>, cualquier fecha futura (ej. <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-400 font-mono">12/30</code>) y cualquier CVC (<code className="bg-slate-900 px-1 py-0.5 rounded text-amber-400 font-mono">123</code>).
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Error en el pago:</p>
            <p className="text-red-300/90 text-xs mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Boton de Confirmacion */}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-base shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Procesando pago seguro...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-5 h-5" />
            <span>Pagar {new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency.toUpperCase() }).format(item.price)}</span>
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-500">
        <CreditCard className="w-3.5 h-3.5" />
        <span>Pagos procesados directamente por la infraestructura oficial de Stripe</span>
      </div>
    </form>
  );
}

export default function StripeCheckout({ item }: StripeCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initPayment() {
      try {
        setLoading(true);
        setApiError(null);

        const data = await createPaymentIntent({
          amount: item.amountInCents,
          currency: item.currency,
          item_id: item.id,
          item_title: item.title,
          metadata: {
            category: item.category,
            condition: item.condition,
          },
        });

        if (isMounted) {
          setClientSecret(data.client_secret);
        }
      } catch (err: any) {
        if (isMounted) {
          setApiError(err.message || 'Error al conectar con la API de pagos.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initPayment();

    return () => {
      isMounted = false;
    };
  }, [item]);

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_...')) {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-3">
        <div className="flex items-center gap-2 font-bold text-base">
          <AlertCircle className="w-5 h-5 text-amber-400" />
          <span>Configuración requerida: Clave de Stripe</span>
        </div>
        <p className="text-sm text-slate-300">
          No se ha configurado la clave pública de Stripe en el frontend.
        </p>
        <p className="text-xs text-slate-400">
          Por favor, copia <code className="bg-slate-900 px-2 py-0.5 rounded text-amber-300">frontend/.env.example</code> a <code className="bg-slate-900 px-2 py-0.5 rounded text-amber-300">frontend/.env.local</code> y define tu <code className="text-white">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...</code>.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm">Iniciando sesión segura de Stripe Payment Intent...</p>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 space-y-3">
        <div className="flex items-center gap-2 font-bold">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span>Error al conectar con el microservicio Payments API</span>
        </div>
        <p className="text-sm text-slate-300">{apiError}</p>
        <div className="text-xs text-slate-400 space-y-1">
          <p>Asegúrate de:</p>
          <ul className="list-disc list-inside">
            <li>Tener el microservicio FastAPI corriendo en <code className="text-amber-400">http://localhost:8000</code>.</li>
            <li>Haber configurado <code className="text-amber-400">STRIPE_SECRET_KEY</code> en <code className="text-slate-300">payments-api/.env</code>.</li>
          </ul>
        </div>
      </div>
    );
  }

  if (!clientSecret || !stripePromise) {
    return null;
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#f59e0b',
        colorBackground: '#0f172a',
        colorText: '#f8fafc',
        colorDanger: '#ef4444',
        fontFamily: 'system-ui, sans-serif',
        borderRadius: '12px',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm item={item} />
    </Elements>
  );
}

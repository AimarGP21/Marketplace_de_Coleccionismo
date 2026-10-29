'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  CollectibleItem,
  CheckoutSessionResponse,
  PayLaterResponse,
  QRCodeResponse,
  ApiErrorDetail,
} from '@/types';
import {
  createCheckoutSession,
  getCheckoutQRCode,
  submitPayLater,
  triggerWebhookMock,
  getOrderDetails,
  dispatchWebhookSimulation,
} from '@/services/api';
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  QrCode,
  CreditCard,
  Clock,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ChevronRight,
  FileText,
  BadgeAlert,
  WifiOff,
  Flame,
} from 'lucide-react';

interface Props {
  item: CollectibleItem;
}

type CheckoutStep = 1 | 2 | 3;
type PaymentOption = 'QR' | 'BNPL';

export default function AlternativeCheckout({ item }: Props) {
  // --- Estados del Flujo y Stepper ---
  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1);
  const [selectedMethod, setSelectedMethod] = useState<PaymentOption>('QR');

  // Datos del Cliente (Paso 1)
  const [customerName, setCustomerName] = useState('Alejandro Morales');
  const [customerEmail, setCustomerEmail] = useState('coleccionista@relicvault.com');
  const [customerPhone, setCustomerPhone] = useState('+52 55 1234 5678');
  const [shippingAddress, setShippingAddress] = useState('Av. Insurgentes Sur 1602, CDMX');

  // Estado de la Sesión en el Backend
  const [session, setSession] = useState<CheckoutSessionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Manejo Visual de Errores
  const [errorState, setErrorState] = useState<ApiErrorDetail | null>(null);

  // Estados de Opción A: QR Dinámico
  const [qrInfo, setQrInfo] = useState<QRCodeResponse | null>(null);
  const [qrCountdown, setQrCountdown] = useState<number>(0);
  const [pollingActive, setPollingActive] = useState<boolean>(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Estados de Opción B: BNPL (Paga Después)
  const [nationalId, setNationalId] = useState('ID-MX-9823419');
  const [monthlyIncome, setMonthlyIncome] = useState<number>(3500);
  const [installments, setInstallments] = useState<number>(3);
  const [bnplResult, setBnplResult] = useState<PayLaterResponse | null>(null);

  // Modos de Simulación Sandbox de Error
  const [simulatedScenario, setSimulatedScenario] = useState<string>('normal');
  const [webhookLog, setWebhookLog] = useState<string | null>(null);

  // Limpiar temporizadores al desmontar
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Temporizador regresivo para el código QR
  useEffect(() => {
    if (qrCountdown <= 0) return;
    const timer = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Al expirar
          setErrorState({
            status: 400,
            message: 'El tiempo límite para pagar este código QR ha expirado.',
            errorType: 'EXPIRED',
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [qrCountdown]);

  // Polling de confirmación para el QR
  useEffect(() => {
    if (!pollingActive || !session?.order_id || currentStep !== 2) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    pollTimerRef.current = setInterval(async () => {
      try {
        const orderData = await getOrderDetails(session.order_id);
        if (orderData.status === 'PAID') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setPollingActive(false);
          setCurrentStep(3); // Avanzar a Éxito
        } else if (orderData.status === 'EXPIRED') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setPollingActive(false);
          setErrorState({
            status: 400,
            message: 'La orden fue marcada como expirada por la pasarela.',
            errorType: 'EXPIRED',
          });
        } else if (orderData.status === 'REJECTED') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setPollingActive(false);
          setErrorState({
            status: 400,
            message: 'El pago vía QR fue rechazado por el banco emisor.',
            errorType: 'REJECTED',
          });
        }
      } catch (err) {
        // En sondeo no bloqueamos inmediatamente ante un micro-error transitorio
        console.warn('Polling check error:', err);
      }
    }, 2500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [pollingActive, session?.order_id, currentStep]);

  // Formateador de moneda
  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  // ============================================================================
  // ACCIONES Y FLUJO
  // ============================================================================

  // Paso 1 -> Paso 2: Crear la Sesión en FastAPI
  const handleProceedToPayment = async (overrideScenario?: string) => {
    setErrorState(null);
    setLoading(true);
    const scenario = overrideScenario || simulatedScenario;

    try {
      const resp = await createCheckoutSession({
        item_id: item.id,
        item_title: item.title,
        amount: item.price,
        currency: 'USD',
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          shipping_address: shippingAddress,
        },
        test_scenario: scenario === 'simulate_error_500' ? 'simulate_error_500' : 'normal',
      });

      setSession(resp);
      setCurrentStep(2);

      // Cargar QR de una vez si la opción inicial es QR
      if (selectedMethod === 'QR') {
        loadQRCode(resp.order_id);
      }
    } catch (err: any) {
      setErrorState(err as ApiErrorDetail);
    } finally {
      setLoading(false);
    }
  };

  // Cargar QR Dinámico
  const loadQRCode = async (orderId: string) => {
    setErrorState(null);
    setLoading(true);
    try {
      const qrData = await getCheckoutQRCode(orderId);
      setQrInfo(qrData);
      setQrCountdown(qrData.seconds_remaining);
      setPollingActive(true);
    } catch (err: any) {
      setErrorState(err as ApiErrorDetail);
    } finally {
      setLoading(false);
    }
  };

  // Enviar Solicitud BNPL (Paga Después)
  const handleProcessBNPL = async (overrideScenario?: string) => {
    if (!session) return;
    setErrorState(null);
    setLoading(true);
    const scenario = overrideScenario || simulatedScenario;

    try {
      const result = await submitPayLater({
        order_id: session.order_id,
        national_id: nationalId,
        monthly_income: Number(monthlyIncome),
        installments: Number(installments),
        test_scenario: scenario as any,
      });

      setBnplResult(result);
      setCurrentStep(3); // Éxito
    } catch (err: any) {
      setErrorState(err as ApiErrorDetail);
    } finally {
      setLoading(false);
    }
  };

  // Simular Webhook Asíncrono de QR (Éxito o Rechazo)
  const handleSimulateWebhook = async (
    action: 'CONFIRM_PAYMENT' | 'REJECT_PAYMENT' | 'EXPIRE_ORDER'
  ) => {
    if (!session) return;
    setLoading(true);
    try {
      await triggerWebhookMock({
        order_id: session.order_id,
        action,
        payment_reference: `SIM-SPEI-${Math.floor(100000 + Math.random() * 900000)}`,
      });
      // El polling lo detectará, pero forzamos sincronización inmediata:
      const updated = await getOrderDetails(session.order_id);
      if (updated.status === 'PAID') {
        setPollingActive(false);
        setCurrentStep(3);
      } else if (updated.status === 'REJECTED') {
        setErrorState({
          status: 400,
          message: 'Transacción QR rechazada: Fondos insuficientes en la cuenta bancaria de origen.',
          errorType: 'REJECTED',
        });
      } else if (updated.status === 'EXPIRED') {
        setErrorState({
          status: 400,
          message: 'El código QR ha expirado.',
          errorType: 'EXPIRED',
        });
      }
    } catch (err: any) {
      setErrorState(err as ApiErrorDetail);
    } finally {
      setLoading(false);
    }
  };

  // Reintentar Operación
  const handleRetry = () => {
    setErrorState(null);
    if (currentStep === 1) {
      handleProceedToPayment('normal');
    } else if (currentStep === 2) {
      if (selectedMethod === 'QR' && session) {
        loadQRCode(session.order_id);
      } else if (selectedMethod === 'BNPL') {
        handleProcessBNPL('normal');
      }
    }
  };

  // Cambiar Método de Pago
  const handleChangeMethod = () => {
    setErrorState(null);
    if (selectedMethod === 'QR') {
      setSelectedMethod('BNPL');
      setPollingActive(false);
    } else {
      setSelectedMethod('QR');
      if (session) {
        loadQRCode(session.order_id);
      }
    }
  };

  // Reiniciar todo el flujo
  const handleResetFlow = () => {
    setErrorState(null);
    setSession(null);
    setQrInfo(null);
    setBnplResult(null);
    setPollingActive(false);
    setCurrentStep(1);
  };

  // ============================================================================
  // RENDER: COMPONENTES AUXILIARES
  // ============================================================================

  // Barra de Pasos (Stepper)
  const renderStepper = () => {
    const steps = [
      { num: 1, title: 'Datos y Resumen' },
      { num: 2, title: 'Método Alternativo' },
      { num: 3, title: 'Confirmación' },
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-md mx-auto">
          {steps.map((s, index) => {
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;

            return (
              <React.Fragment key={s.num}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      isCompleted
                        ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                        : isCurrent
                        ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-400/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : s.num}
                  </div>
                  <span
                    className={`text-[11px] font-medium mt-1.5 transition-colors ${
                      isCurrent ? 'text-amber-300 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 -mt-4 transition-colors ${
                      currentStep > s.num ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  // Banner / Modal Visual de Gestión de Errores
  const renderErrorState = () => {
    if (!errorState) return null;

    let title = 'Ha ocurrido un error inesperado';
    let icon = <AlertCircle className="w-6 h-6 text-rose-400" />;
    let badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';

    if (errorState.errorType === 'NETWORK_ERROR') {
      title = 'Fallo de Conexión de Red';
      icon = <WifiOff className="w-6 h-6 text-rose-400" />;
    } else if (errorState.errorType === 'REJECTED') {
      title = 'Transacción Rechazada';
      icon = <BadgeAlert className="w-6 h-6 text-rose-400" />;
    } else if (errorState.errorType === 'EXPIRED') {
      title = 'Tiempo de Espera Agotado';
      icon = <Clock className="w-6 h-6 text-amber-400" />;
      badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }

    return (
      <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-rose-950/40 border border-rose-800/80 text-white animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-rose-500/20 shrink-0">{icon}</div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm sm:text-base text-rose-200">{title}</h4>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${badgeColor}`}
              >
                HTTP {errorState.status || 'ERR'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-rose-200/80 leading-relaxed">
              {errorState.message}
            </p>
          </div>
        </div>

        {/* Botones Interactivos de Recuperación */}
        <div className="mt-4 pt-3 border-t border-rose-900/60 flex flex-wrap gap-2.5">
          <button
            onClick={handleRetry}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reintentar Operación</span>
          </button>

          {currentStep === 2 && (
            <button
              onClick={handleChangeMethod}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Cambiar a {selectedMethod === 'QR' ? 'Paga Después (BNPL)' : 'Código QR'}
              </span>
            </button>
          )}

          <button
            onClick={handleResetFlow}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 text-xs transition-colors ml-auto"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reiniciar Checkout</span>
          </button>
        </div>
      </div>
    );
  };

  // Selector de Escenarios de Prueba Sandbox
  const renderSandboxControlPanel = () => {
    return (
      <div className="mt-8 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-semibold text-amber-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Simulador de Escenarios Sandbox
          </span>
          <span className="text-[10px] text-slate-400 font-mono">FastAPI Mock Engine</span>
        </div>
        <p className="text-slate-400">
          Prueba de estrés y tolerancia a fallos: fuerza respuestas del microservicio para verificar
          los estados de error en la UI.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => {
              setSimulatedScenario('normal');
              setErrorState(null);
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
              simulatedScenario === 'normal'
                ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            🟢 Flujo Normal (Éxito)
          </button>

          <button
            type="button"
            onClick={() => {
              setSimulatedScenario('insufficient_funds');
              if (currentStep === 2 && selectedMethod === 'BNPL') {
                handleProcessBNPL('insufficient_funds');
              }
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
              simulatedScenario === 'insufficient_funds'
                ? 'bg-rose-950/50 border-rose-500 text-rose-300 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            🔴 Fondos Insuficientes (400)
          </button>

          <button
            type="button"
            onClick={() => {
              setSimulatedScenario('reject_credit');
              if (currentStep === 2 && selectedMethod === 'BNPL') {
                handleProcessBNPL('reject_credit');
              }
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
              simulatedScenario === 'reject_credit'
                ? 'bg-rose-950/50 border-rose-500 text-rose-300 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            🚫 Crédito Rechazado (400)
          </button>

          <button
            type="button"
            onClick={() => {
              setSimulatedScenario('simulate_error_500');
              if (currentStep === 1) {
                handleProceedToPayment('simulate_error_500');
              } else if (currentStep === 2 && selectedMethod === 'BNPL') {
                handleProcessBNPL('server_error');
              }
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
              simulatedScenario === 'simulate_error_500'
                ? 'bg-purple-950/50 border-purple-500 text-purple-300 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            💥 Fallo Servidor (500)
          </button>
        </div>

        {/* Sección de prueba del Dispatcher de Webhooks hacia Next.js */}
        {session && (
          <div className="pt-3 border-t border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">
              🚀 Probar Ciclo Completo Webhook (FastAPI ➡️ Next.js /api/webhooks):
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setWebhookLog('Enviando webhook válido...');
                    const res = await dispatchWebhookSimulation({
                      order_id: session.order_id,
                      event_type: 'payment.qr.confirmed',
                      status: 'paid',
                    });
                    setWebhookLog(`HTTP ${res.status_code}: Next.js procesó exitosamente el evento de pago.`);
                    if (res.status_code === 200) {
                      setCurrentStep(3);
                    }
                  } catch (e: any) {
                    setWebhookLog(`Error: ${e.message || String(e)}`);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-700/60 hover:bg-emerald-600 text-[11px] text-white border border-emerald-500/40"
              >
                📡 Disparar Webhook Válido (200 OK)
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    setWebhookLog('Enviando webhook con firma errónea...');
                    const res = await dispatchWebhookSimulation({
                      order_id: session.order_id,
                      event_type: 'payment.qr.confirmed',
                      status: 'paid',
                      custom_signature: 'firma_invalida_hack_123',
                    });
                    setWebhookLog(`HTTP ${res.status_code}: ${res.error || 'Firma no autorizada rechazada correctamente por Next.js.'}`);
                  } catch (e: any) {
                    setWebhookLog(`Error: ${e.message || String(e)}`);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-900/40 hover:bg-amber-800/60 text-[11px] text-amber-200 border border-amber-600/40"
              >
                🔒 Probar Firma Inválida (401)
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    setWebhookLog('Enviando payload JSON corrupto...');
                    const res = await dispatchWebhookSimulation({
                      order_id: session.order_id,
                      event_type: 'payment.qr.confirmed',
                      status: 'paid',
                      simulate_invalid_json: true,
                    });
                    setWebhookLog(`HTTP ${res.status_code}: ${res.error || 'Payload malformado rechazado correctamente con 400.'}`);
                  } catch (e: any) {
                    setWebhookLog(`Error: ${e.message || String(e)}`);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-900/40 hover:bg-rose-800/60 text-[11px] text-rose-200 border border-rose-600/40"
              >
                ⚠️ Probar JSON Malformado (400)
              </button>
            </div>

            {webhookLog && (
              <div className="mt-2 p-2 rounded-lg bg-slate-900 font-mono text-[10px] text-amber-300/90 border border-slate-800">
                {webhookLog}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // PASO 1: RESUMEN Y DATOS DEL CLIENTE
  // ============================================================================
  const renderStep1 = () => {
    return (
      <div className="space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h2 className="text-lg font-bold text-white">Paso 1: Información de Entrega</h2>
          <p className="text-xs text-slate-400 mt-1">
            Ingresa los datos para registrar la orden en el microservicio FastAPI.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nombre Completo del Comprador
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              placeholder="Ej. Juan Pérez"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                placeholder="juan@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                placeholder="+52 55 ..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Dirección de Entrega Asegurada
            </label>
            <input
              type="text"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
              placeholder="Calle, Número, Colonia, Ciudad, Código Postal"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => handleProceedToPayment()}
            disabled={loading || !customerName || !customerEmail}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm rounded-xl transition-colors shadow-lg shadow-amber-400/10 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Creando sesión en FastAPI...</span>
              </>
            ) : (
              <>
                <span>Continuar a Selección de Método de Pago</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // PASO 2: SELECCIÓN DE MÉTODO ALTERNATIVO (QR O BNPL)
  // ============================================================================
  const renderStep2 = () => {
    return (
      <div className="space-y-6">
        <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Paso 2: Método de Pago Alternativo</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Orden activa: <span className="font-mono text-amber-400">{session?.order_id}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className="text-xs text-slate-400 hover:text-white"
          >
            Editar datos
          </button>
        </div>

        {/* Pestañas de Selección de Método Alternativo */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedMethod('QR');
              setErrorState(null);
              if (session && !qrInfo) {
                loadQRCode(session.order_id);
              }
            }}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              selectedMethod === 'QR'
                ? 'bg-amber-400/10 border-amber-400 text-amber-300 shadow-md ring-1 ring-amber-400/30'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <QrCode className="w-6 h-6" />
            <div className="text-center">
              <span className="block text-xs font-bold">Código QR Dinámico</span>
              <span className="text-[10px] text-slate-400">Pago instantáneo CoDi / SPEI</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedMethod('BNPL');
              setErrorState(null);
              setPollingActive(false);
            }}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              selectedMethod === 'BNPL'
                ? 'bg-amber-400/10 border-amber-400 text-amber-300 shadow-md ring-1 ring-amber-400/30'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <CreditCard className="w-6 h-6" />
            <div className="text-center">
              <span className="block text-xs font-bold">Paga Después (BNPL)</span>
              <span className="text-[10px] text-slate-400">Financiamiento en hasta 12 cuotas</span>
            </div>
          </button>
        </div>

        {/* OPCIÓN A: CÓDIGO QR DINÁMICO */}
        {selectedMethod === 'QR' && (
          <div className="space-y-4 pt-2">
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 flex flex-col items-center text-center">
              {loading && !qrInfo ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
                  <span className="text-xs text-slate-400">Generando QR con FastAPI...</span>
                </div>
              ) : qrInfo ? (
                <>
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    <img
                      src={qrInfo.qr_image_base64}
                      alt="Código QR de Pago Dinámico"
                      className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                    />
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-xs">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-slate-300">Expira en:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {Math.floor(qrCountdown / 60)}:
                      {String(qrCountdown % 60).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-400 max-w-xs leading-relaxed">
                    Escanea con cualquier app bancaria habilitada para pagos dinámicos o simula la
                    confirmación con los botones inferiores.
                  </div>

                  {pollingActive && (
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Sondeando confirmación de pago en tiempo real...</span>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Controles de Simulación Asíncrona (Mock Webhook) */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2.5">
              <span className="text-xs font-semibold text-slate-300 block">
                🧪 Simulación de Pasarela Webhook (Disparar evento asíncrono):
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSimulateWebhook('CONFIRM_PAYMENT')}
                  disabled={loading}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow"
                >
                  ⚡ Simular Pago Exitoso
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateWebhook('REJECT_PAYMENT')}
                  disabled={loading}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  ⚠️ Simular Rechazo Bancario
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateWebhook('EXPIRE_ORDER')}
                  disabled={loading}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
                >
                  ⏳ Simular Timeout / Expiración
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OPCIÓN B: PAGA DESPUÉS (BNPL) */}
        {selectedMethod === 'BNPL' && (
          <div className="space-y-4 pt-2">
            <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Solicitud de Crédito Instantáneo RelicVault</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Documento de Identidad Oficial (DNI / INE / CURP)
                </label>
                <input
                  type="text"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  placeholder="ID oficial"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ingreso Mensual Estimado (USD)
                </label>
                <input
                  type="number"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  min="500"
                  step="100"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  * Si la cuota mensual supera el 40% de tu ingreso mensual, el microservicio rechazará el crédito.
                </span>
              </div>

              {/* Selector de Cuotas */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Selecciona el Plan de Cuotas
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { n: 3, fee: 0, label: '3 cuotas sin interés' },
                    { n: 6, fee: 0.05, label: '6 cuotas (+5%)' },
                    { n: 12, fee: 0.1, label: '12 cuotas (+10%)' },
                  ].map((p) => {
                    const total = item.price * (1 + p.fee);
                    const quota = total / p.n;
                    const isSelected = installments === p.n;

                    return (
                      <button
                        key={p.n}
                        type="button"
                        onClick={() => setInstallments(p.n)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-amber-400/20 border-amber-400 text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="block text-xs font-bold text-white">{p.n} cuotas</span>
                        <span className="text-sm font-black text-amber-400">
                          {formatMoney(quota)}
                          <span className="text-[10px] font-normal text-slate-400">/mes</span>
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-1">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleProcessBNPL()}
              disabled={loading || !nationalId || monthlyIncome <= 0}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm rounded-xl transition-colors shadow-lg shadow-amber-400/10 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Evaluando scoring crediticio en FastAPI...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Aprobar y Pagar en {installments} Cuotas</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // PASO 3: CONFIRMACIÓN DE ÉXITO
  // ============================================================================
  const renderStep3 = () => {
    return (
      <div className="space-y-6 text-center py-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-xl shadow-emerald-500/10 animate-in zoom-in-75 duration-300">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
            Transacción Aprobada Exitosamente
          </span>
          <h2 className="text-2xl font-black text-white">¡Gracias por tu compra!</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-1.5">
            El coleccionable ha sido reservado y puesto en preparación con custodia segura.
          </p>
        </div>

        {/* Recibo Detallado */}
        <div className="max-w-md mx-auto bg-slate-950 rounded-2xl border border-slate-800 p-5 text-left space-y-3.5 text-xs">
          <div className="flex justify-between border-b border-slate-800 pb-2.5">
            <span className="text-slate-400">ID de Orden:</span>
            <span className="font-mono text-amber-400 font-semibold">{session?.order_id}</span>
          </div>

          <div className="flex justify-between border-b border-slate-800 pb-2.5">
            <span className="text-slate-400">Artículo:</span>
            <span className="text-white font-medium text-right line-clamp-1">{item.title}</span>
          </div>

          <div className="flex justify-between border-b border-slate-800 pb-2.5">
            <span className="text-slate-400">Método Aplicado:</span>
            <span className="text-slate-200 font-semibold">
              {selectedMethod === 'QR' ? 'Código QR Dinámico (Inmediato)' : 'Paga Después / BNPL'}
            </span>
          </div>

          {bnplResult?.plan && (
            <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/20 space-y-1.5">
              <div className="flex justify-between text-amber-300 font-bold">
                <span>Plan de Financiamiento:</span>
                <span>{bnplResult.plan.installments} cuotas</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Monto mensual:</span>
                <span>{formatMoney(bnplResult.plan.monthly_amount)}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Código de Autorización:</span>
                <span className="font-mono">{bnplResult.authorization_code}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between border-b border-slate-800 pb-2.5">
            <span className="text-slate-400">Comprador:</span>
            <span className="text-slate-200">{customerName}</span>
          </div>

          <div className="flex justify-between text-sm font-bold text-white pt-1">
            <span>Total Transaccionado:</span>
            <span className="text-emerald-400">
              {formatMoney(bnplResult?.plan ? bnplResult.plan.total_amount : item.price)}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleResetFlow}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Realizar otra compra de prueba</span>
          </button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER PRINCIPAL
  // ============================================================================
  return (
    <div className="space-y-6">
      {/* Barra de Pasos */}
      {renderStepper()}

      {/* Manejador Visual de Errores con Botones de Reintento */}
      {renderErrorState()}

      {/* Pantalla según el paso actual */}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}

      {/* Panel de Simulación Sandbox */}
      {renderSandboxControlPanel()}
    </div>
  );
}


import { NextRequest, NextResponse } from 'next/server';

// Clave secreta simulada compartida entre pasarela/FastAPI y la ruta de Next.js
const WEBHOOK_SECRET_KEY = process.env.PAYMENTS_WEBHOOK_SECRET || 'relicvault_sandbox_whsec_supersecure_key_2026';

interface WebhookIncomingPayload {
  event_type: string;
  order_id: string;
  status: 'paid' | 'rejected' | 'expired';
  timestamp: number;
  payment_method?: string;
  amount?: number;
  currency?: string;
  reference?: string;
  reason?: string;
}

export async function POST(req: NextRequest) {
  const correlationId = `wh_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n======================================================`);
  console.log(`[Next.js Webhook Handler] [${correlationId}] Recibiendo evento externo`);

  try {
    // 1. Verificación de encabezados de seguridad y firma simulada
    const signature = req.headers.get('x-webhook-signature');
    const authHeader = req.headers.get('authorization');

    // Admitimos la firma por x-webhook-signature o Bearer token
    const providedToken = signature || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!providedToken) {
      console.warn(`[Next.js Webhook Handler] [${correlationId}] Rechazado: Cabecera 'x-webhook-signature' ausente.`);
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: "Falta el encabezado de firma 'x-webhook-signature' requerido.",
          code: 'MISSING_SIGNATURE',
        },
        { status: 401 }
      );
    }

    if (providedToken !== WEBHOOK_SECRET_KEY) {
      console.warn(`[Next.js Webhook Handler] [${correlationId}] Rechazado: Firma criptográfica no coincide.`);
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Firma de webhook inválida o alterada.',
          code: 'INVALID_SIGNATURE',
        },
        { status: 401 }
      );
    }

    // 2. Extracción y parseo seguro del cuerpo JSON
    let body: WebhookIncomingPayload;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error(`[Next.js Webhook Handler] [${correlationId}] Payload JSON malformado.`);
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Cuerpo de petición no es un JSON válido.',
          code: 'MALFORMED_JSON',
        },
        { status: 400 }
      );
    }

    const { event_type, order_id, status: paymentStatus, timestamp } = body;

    // 3. Validación de campos obligatorios
    if (!event_type || !order_id || !paymentStatus) {
      console.warn(`[Next.js Webhook Handler] [${correlationId}] Campos requeridos faltantes:`, {
        event_type,
        order_id,
        paymentStatus,
      });
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: "Los campos 'event_type', 'order_id' y 'status' son obligatorios.",
          code: 'VALIDATION_FAILED',
        },
        { status: 400 }
      );
    }

    const validStatuses = ['paid', 'rejected', 'expired'];
    if (!validStatuses.includes(paymentStatus.toLowerCase())) {
      console.warn(`[Next.js Webhook Handler] [${correlationId}] Estado inválido: '${paymentStatus}'.`);
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: `Estado '${paymentStatus}' no soportado. Valores válidos: [paid, rejected, expired].`,
          code: 'INVALID_STATUS_VALUE',
        },
        { status: 400 }
      );
    }

    // 4. Lógica de negocio condicional según el método y evento
    console.log(`[Next.js Webhook Handler] [${correlationId}] Procesando evento:`, {
      event_type,
      order_id,
      paymentStatus,
      amount: body.amount,
      currency: body.currency,
      timestamp,
    });

    switch (event_type) {
      case 'payment.qr.confirmed':
      case 'payment.succeeded':
        console.log(`[Next.js Webhook Handler] [${correlationId}] ✅ ORDEN COBRADA EXITOSAMENTE:`);
        console.log(`   - Orden: ${order_id}`);
        console.log(`   - Método: ${body.payment_method || 'QR_DYNAMIC'}`);
        console.log(`   - Referencia: ${body.reference || 'N/A'}`);
        // En una arquitectura completa aquí se actualizaría la base de datos principal,
        // se enviaría el correo de confirmación de despacho y se notificaría al usuario.
        break;

      case 'payment.bnpl.approved':
        console.log(`[Next.js Webhook Handler] [${correlationId}] 💳 CRÉDITO PAGA DESPUÉS (BNPL) AUTORIZADO:`);
        console.log(`   - Orden: ${order_id}`);
        console.log(`   - Autorización: ${body.reference}`);
        break;

      case 'payment.rejected':
      case 'payment.bnpl.rejected':
        console.warn(`[Next.js Webhook Handler] [${correlationId}] ❌ PAGO RECHAZADO:`);
        console.warn(`   - Orden: ${order_id}`);
        console.warn(`   - Razón: ${body.reason || 'Fondos insuficientes / Validación de riesgo fallida'}`);
        break;

      case 'payment.expired':
        console.info(`[Next.js Webhook Handler] [${correlationId}] ⏳ ORDEN EXPIRADA:`);
        console.info(`   - Orden: ${order_id}`);
        break;

      default:
        console.info(`[Next.js Webhook Handler] [${correlationId}] Evento genérico recibido: ${event_type}`);
    }

    console.log(`======================================================\n`);

    // 5. Respuesta HTTP inmediata 200 OK con acuse de recibo para evitar reintentos de la pasarela
    return NextResponse.json(
      {
        received: true,
        correlation_id: correlationId,
        order_id,
        processed_at: Date.now(),
        status: paymentStatus,
        message: `Evento '${event_type}' procesado correctamente por Next.js.`,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error(`[Next.js Webhook Handler] [${correlationId}] Error interno no controlado:`, err);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Error inesperado al procesar el webhook.',
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}

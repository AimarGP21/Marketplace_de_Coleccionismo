import {
  CreatePaymentIntentResponse,
  PaymentStatusResponse,
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  PayLaterRequest,
  PayLaterResponse,
  QRCodeResponse,
  WebhookMockRequest,
  WebhookMockResponse,
  SimulateWebhookDispatchRequest,
  SimulateWebhookDispatchResponse,
  ApiErrorDetail,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_PAYMENTS_API_URL || 'http://localhost:8000';

/**
 * Helper para estandarizar el manejo de excepciones de red y errores HTTP estructurados
 */
async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = res.statusText || 'Error desconocido del servidor';
    }

    let errorType: ApiErrorDetail['errorType'] = 'SERVER_ERROR';
    if (res.status === 400) {
      if (errorDetail.toLowerCase().includes('expirad')) {
        errorType = 'EXPIRED';
      } else {
        errorType = 'REJECTED';
      }
    } else if (res.status === 404) {
      errorType = 'EXPIRED';
    } else if (res.status === 422) {
      errorType = 'VALIDATION';
    }

    const errorObj: ApiErrorDetail = {
      status: res.status,
      message: errorDetail,
      errorType,
    };
    throw errorObj;
  }
  return res.json();
}

function handleFetchCatch(error: any): never {
  if (error && typeof error === 'object' && 'errorType' in error) {
    throw error;
  }
  // Error de conexión o red (ej. Backend caído, CORS, timeout)
  const networkError: ApiErrorDetail = {
    status: 0,
    message: error?.message || 'No se pudo conectar con el microservicio de pagos (FastAPI). Verifica que esté encendido.',
    errorType: 'NETWORK_ERROR',
  };
  throw networkError;
}

// ============================================================================
// CHECKOUT ALTERNATIVO (QR Y PAGA DESPUÉS / BNPL)
// ============================================================================

export async function createCheckoutSession(
  req: CheckoutSessionRequest
): Promise<CheckoutSessionResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/checkout/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    return await handleResponse<CheckoutSessionResponse>(res);
  } catch (error) {
    return handleFetchCatch(error);
  }
}

export async function getCheckoutQRCode(orderId: string): Promise<QRCodeResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/checkout/qr-code/${orderId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    return await handleResponse<QRCodeResponse>(res);
  } catch (error) {
    return handleFetchCatch(error);
  }
}

export async function submitPayLater(req: PayLaterRequest): Promise<PayLaterResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/checkout/pay-later`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    return await handleResponse<PayLaterResponse>(res);
  } catch (error) {
    return handleFetchCatch(error);
  }
}

export async function triggerWebhookMock(
  req: WebhookMockRequest
): Promise<WebhookMockResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/checkout/webhook-mock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    return await handleResponse<WebhookMockResponse>(res);
  } catch (error) {
    return handleFetchCatch(error);
  }
}

export async function getOrderDetails(orderId: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/checkout/order/${orderId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    return await handleResponse<any>(res);
  } catch (error) {
    return handleFetchCatch(error);
  }
}

export async function dispatchWebhookSimulation(
  req: SimulateWebhookDispatchRequest
): Promise<SimulateWebhookDispatchResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/checkout/simulate-webhook-dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    return await handleResponse<SimulateWebhookDispatchResponse>(res);
  } catch (error) {
    return handleFetchCatch(error);
  }
}

// ============================================================================
// STRIPE ORIGINAL
// ============================================================================

export async function createPaymentIntent(params: {
  amount: number;
  currency: string;
  item_id: string;
  item_title: string;
  buyer_email?: string;
  metadata?: Record<string, any>;
}): Promise<CreatePaymentIntentResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/payments/create-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error al crear la intención de pago: ${response.statusText}`);
  }

  return response.json();
}

export async function confirmPayment(paymentIntentId: string): Promise<PaymentStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/payments/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_intent_id: paymentIntentId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error al confirmar el pago: ${response.statusText}`);
  }

  return response.json();
}

export async function getPaymentStatus(paymentIntentId: string): Promise<PaymentStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/payments/${paymentIntentId}/status`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error al consultar estado de pago: ${response.statusText}`);
  }

  return response.json();
}

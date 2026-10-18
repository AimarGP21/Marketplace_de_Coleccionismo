import { CreatePaymentIntentResponse, PaymentStatusResponse } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_PAYMENTS_API_URL || 'http://localhost:8000';

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
    headers: {
      'Content-Type': 'application/json',
    },
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
    headers: {
      'Content-Type': 'application/json',
    },
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
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error al consultar estado de pago: ${response.statusText}`);
  }

  return response.json();
}

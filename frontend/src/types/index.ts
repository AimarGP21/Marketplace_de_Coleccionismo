export interface CollectibleItem {
  id: string;
  title: string;
  category: 'Cartas TCG' | 'Monedas Antiguas' | 'Cómics' | 'Figuras de Acción' | 'Relojes Vintage';
  price: number; // En dolares, ej: 450.00
  amountInCents: number; // En centavos, ej: 45000
  currency: string;
  image: string;
  rarity: string;
  condition: string;
  description: string;
  seller: {
    name: string;
    rating: number;
    salesCount: number;
  };
  verifiedAuthenticity: boolean;
}

export interface CreatePaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentStatusResponse {
  payment_intent_id: string;
  status: string;
  amount: number;
  currency: string;
  item_id?: string;
  item_title?: string;
  customer_email?: string;
  receipt_url?: string;
  created?: number;
}

// --- Tipos para el Checkout Alternativo (QR Dinámico y BNPL Paga Después) ---

export type OrderStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED' | 'EXPIRED';

export interface CustomerInfo {
  name: string;
  email: string;
  phone?: string;
  shipping_address?: string;
}

export interface CheckoutSessionRequest {
  item_id: string;
  item_title: string;
  amount: number;
  currency?: string;
  customer: CustomerInfo;
  test_scenario?: 'normal' | 'simulate_error_500';
}

export interface CheckoutSessionResponse {
  order_id: string;
  status: OrderStatus;
  amount: number;
  currency: string;
  item_id: string;
  item_title: string;
  customer: CustomerInfo;
  expires_at: number;
  created_at: number;
}

export interface InstallmentPlan {
  installments: number;
  monthly_amount: number;
  total_amount: number;
  interest_rate: number;
}

export interface PayLaterRequest {
  order_id: string;
  national_id: string;
  monthly_income: number;
  installments: number;
  test_scenario?: 'normal' | 'reject_credit' | 'insufficient_funds' | 'server_error';
}

export interface PayLaterResponse {
  order_id: string;
  status: OrderStatus;
  decision: 'APPROVED' | 'REJECTED';
  plan: InstallmentPlan;
  authorization_code?: string;
  reason?: string;
}

export interface QRCodeResponse {
  order_id: string;
  status: OrderStatus;
  qr_data: string;
  qr_image_base64: string;
  expires_at: number;
  seconds_remaining: number;
  amount: number;
  currency: string;
}

export interface WebhookMockRequest {
  order_id: string;
  action: 'CONFIRM_PAYMENT' | 'REJECT_PAYMENT' | 'EXPIRE_ORDER';
  payment_reference?: string;
}

export interface WebhookMockResponse {
  success: boolean;
  order_id: string;
  new_status: OrderStatus;
  message: string;
}

export interface ApiErrorDetail {
  status: number;
  message: string;
  errorType: 'NETWORK_ERROR' | 'REJECTED' | 'EXPIRED' | 'VALIDATION' | 'SERVER_ERROR';
}


// Tipos para la simulación de despacho de Webhooks entre FastAPI y Next.js
export interface SimulateWebhookDispatchRequest {
  order_id: string;
  event_type: 'payment.qr.confirmed' | 'payment.bnpl.approved' | 'payment.rejected' | 'payment.expired';
  status: 'paid' | 'rejected' | 'expired';
  custom_signature?: string;
  simulate_invalid_json?: boolean;
}

export interface SimulateWebhookDispatchResponse {
  success: boolean;
  status_code: number;
  target_url: string;
  sent_payload?: Record<string, any>;
  nextjs_response?: Record<string, any>;
  error?: string;
}

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

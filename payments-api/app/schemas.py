from typing import Optional, Dict, Any, List
from enum import Enum
from pydantic import BaseModel, Field

# Modelos originales de Stripe
class CreatePaymentIntentRequest(BaseModel):
    amount: int = Field(..., gt=0, description="Monto en centavos (ej. 15000 = $150.00)")
    currency: str = Field(default="usd", min_length=3, max_length=3, description="Codigo de moneda ISO (ej. usd, eur, mxn)")
    item_id: str = Field(..., description="Identificador unico del articulo coleccionable")
    item_title: str = Field(..., description="Nombre o titulo del coleccionable")
    buyer_email: Optional[str] = Field(default=None, description="Correo electronico del comprador")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Metadatos adicionales para Stripe")

class CreatePaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: int
    currency: str
    status: str

class ConfirmPaymentRequest(BaseModel):
    payment_intent_id: str = Field(..., description="ID del PaymentIntent a confirmar o verificar")

class PaymentStatusResponse(BaseModel):
    payment_intent_id: str
    status: str
    amount: int
    currency: str
    item_id: Optional[str] = None
    item_title: Optional[str] = None
    customer_email: Optional[str] = None
    receipt_url: Optional[str] = None
    created: Optional[int] = None

class WebhookResponse(BaseModel):
    received: bool
    event_type: str
    payment_intent_id: Optional[str] = None


# --- Modelos para Checkout Alternativo (QR Dinámico y Paga Después / BNPL) ---

class OrderStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    PAID = "PAID"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"

class CustomerInfo(BaseModel):
    name: str = Field(..., min_length=2, description="Nombre completo del cliente")
    email: str = Field(..., description="Correo electrónico del cliente")
    phone: Optional[str] = Field(None, description="Teléfono de contacto")
    shipping_address: Optional[str] = Field(None, description="Dirección física de entrega")

class CheckoutSessionRequest(BaseModel):
    item_id: str = Field(..., description="ID del coleccionable")
    item_title: str = Field(..., description="Título del coleccionable")
    amount: float = Field(..., gt=0, description="Monto total en dólares")
    currency: str = Field(default="USD", description="Moneda (USD, MXN, etc.)")
    customer: CustomerInfo
    test_scenario: Optional[str] = Field(default="normal", description="Simulación: normal, simulate_error_500")

class CheckoutSessionResponse(BaseModel):
    order_id: str
    status: OrderStatus
    amount: float
    currency: str
    item_id: str
    item_title: str
    customer: CustomerInfo
    expires_at: int
    created_at: int

class InstallmentPlan(BaseModel):
    installments: int
    monthly_amount: float
    total_amount: float
    interest_rate: float

class PayLaterRequest(BaseModel):
    order_id: str = Field(..., description="ID de la orden de checkout")
    national_id: str = Field(..., min_length=5, description="Documento de identidad o CURP/DNI")
    monthly_income: float = Field(..., gt=0, description="Ingreso mensual estimado")
    installments: int = Field(default=3, description="Número de cuotas: 3, 6 o 12")
    test_scenario: Optional[str] = Field(
        default="normal", 
        description="Escenario: normal, reject_credit, insufficient_funds, network_error, server_error"
    )

class PayLaterResponse(BaseModel):
    order_id: str
    status: OrderStatus
    decision: str
    plan: InstallmentPlan
    authorization_code: Optional[str] = None
    reason: Optional[str] = None

class QRCodeResponse(BaseModel):
    order_id: str
    status: OrderStatus
    qr_data: str
    qr_image_base64: str
    expires_at: int
    seconds_remaining: int
    amount: float
    currency: str

class WebhookMockAction(str, Enum):
    CONFIRM_PAYMENT = "CONFIRM_PAYMENT"
    REJECT_PAYMENT = "REJECT_PAYMENT"
    EXPIRE_ORDER = "EXPIRE_ORDER"

class WebhookMockRequest(BaseModel):
    order_id: str = Field(..., description="ID de la orden a actualizar")
    action: WebhookMockAction = Field(default=WebhookMockAction.CONFIRM_PAYMENT)
    payment_reference: Optional[str] = Field(default=None, description="Número de referencia de transferencia bancaria")

class WebhookMockResponse(BaseModel):
    success: bool
    order_id: str
    new_status: OrderStatus
    message: str


# Modelos para despacho asíncrono hacia el frontend de Next.js (/api/webhooks)
class SimulateWebhookDispatchRequest(BaseModel):
    order_id: str = Field(..., description="ID de la orden")
    event_type: str = Field(default="payment.qr.confirmed", description="Tipo de evento: payment.qr.confirmed, payment.bnpl.approved, payment.rejected, payment.expired")
    status: str = Field(default="paid", description="Estado del pago: paid, rejected, expired")
    custom_signature: Optional[str] = Field(default=None, description="Firma personalizada para probar validación o error 401")
    simulate_invalid_json: bool = Field(default=False, description="Simula el envío de un payload corrupto para probar error 400")

class SimulateWebhookDispatchResponse(BaseModel):
    success: bool
    status_code: int
    target_url: str
    sent_payload: Optional[Dict[str, Any]] = None
    nextjs_response: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

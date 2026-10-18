from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

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

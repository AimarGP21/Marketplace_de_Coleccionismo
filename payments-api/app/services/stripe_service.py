import stripe
from typing import Optional, Dict, Any
from app.config import STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

class StripeService:
    def __init__(self):
        # Configurar api_key si está definida, pero no bloquear el arranque de la app si no se cuenta aún con ella
        if STRIPE_SECRET_KEY and not STRIPE_SECRET_KEY.startswith("sk_test_..."):
            stripe.api_key = STRIPE_SECRET_KEY

    def _ensure_api_key(self):
        if not STRIPE_SECRET_KEY or STRIPE_SECRET_KEY.startswith("sk_test_..."):
            raise ValueError(
                "La clave STRIPE_SECRET_KEY no esta configurada correctamente en el archivo .env. "
                "Por favor, coloca tu clave secreta de prueba (sk_test_...) en payments-api/.env"
            )
        stripe.api_key = STRIPE_SECRET_KEY

    def create_payment_intent(
        self,
        amount: int,
        currency: str,
        item_id: str,
        item_title: str,
        buyer_email: Optional[str] = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> stripe.PaymentIntent:
        self._ensure_api_key()

        metadata = {
            "item_id": item_id,
            "item_title": item_title,
            "platform": "Marketplace de Coleccionables",
        }
        if extra_metadata:
            metadata.update({k: str(v) for k, v in extra_metadata.items()})

        params: Dict[str, Any] = {
            "amount": amount,
            "currency": currency.lower(),
            "automatic_payment_methods": {"enabled": True},
            "metadata": metadata,
            "description": f"Compra de coleccionable: {item_title} (ID: {item_id})",
        }

        if buyer_email:
            params["receipt_email"] = buyer_email

        intent = stripe.PaymentIntent.create(**params)
        return intent

    def retrieve_payment_intent(self, payment_intent_id: str) -> stripe.PaymentIntent:
        self._ensure_api_key()
        return stripe.PaymentIntent.retrieve(payment_intent_id)

    def confirm_payment_intent(self, payment_intent_id: str) -> stripe.PaymentIntent:
        self._ensure_api_key()
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        if intent.status == "requires_confirmation":
            return stripe.PaymentIntent.confirm(payment_intent_id)
        return intent

    def verify_and_construct_webhook_event(self, payload: bytes, sig_header: str) -> stripe.Event:
        if not STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET.startswith("whsec_..."):
            raise ValueError(
                "STRIPE_WEBHOOK_SECRET no esta configurado en .env. "
                "Ejecuta 'stripe listen' para obtener tu secreto de webhook local."
            )
        return stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=STRIPE_WEBHOOK_SECRET,
        )

stripe_service = StripeService()

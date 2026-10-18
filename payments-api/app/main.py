import logging
from fastapi import FastAPI, HTTPException, Request, Header, status
from fastapi.middleware.cors import CORSMiddleware
import stripe

from app.config import FRONTEND_URL
from app.schemas import (
    CreatePaymentIntentRequest,
    CreatePaymentIntentResponse,
    ConfirmPaymentRequest,
    PaymentStatusResponse,
    WebhookResponse,
)
from app.services.stripe_service import stripe_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("payments-api")

app = FastAPI(
    title="Marketplace de Coleccionables - Payments API",
    description="Microservicio de pagos en FastAPI para el Marketplace de Coleccionables con Stripe Sandbox.",
    version="1.0.0",
)

# Configuracion de CORS
allowed_origins = [
    FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "online",
        "service": "Payments API - Marketplace de Coleccionables",
        "version": "1.0.0",
        "stripe_mode": "Sandbox / Test",
    }

@app.post(
    "/api/v1/payments/create-intent",
    response_model=CreatePaymentIntentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Payments"],
)
async def create_payment_intent(req: CreatePaymentIntentRequest):
    try:
        intent = stripe_service.create_payment_intent(
            amount=req.amount,
            currency=req.currency,
            item_id=req.item_id,
            item_title=req.item_title,
            buyer_email=req.buyer_email,
            extra_metadata=req.metadata,
        )
        return CreatePaymentIntentResponse(
            client_secret=intent.client_secret,
            payment_intent_id=intent.id,
            amount=intent.amount,
            currency=intent.currency,
            status=intent.status,
        )
    except ValueError as e:
        logger.error(f"Error de configuracion de clave: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except stripe.error.StripeError as e:
        logger.error(f"Error en Stripe al crear PaymentIntent: {e.user_message or str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.user_message or "Error procesando intencion de pago en Stripe.",
        )
    except Exception as e:
        logger.exception("Error inesperado al crear PaymentIntent")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.post(
    "/api/v1/payments/confirm",
    response_model=PaymentStatusResponse,
    tags=["Payments"],
)
async def confirm_payment(req: ConfirmPaymentRequest):
    try:
        intent = stripe_service.confirm_payment_intent(req.payment_intent_id)
        metadata = intent.metadata or {}
        return PaymentStatusResponse(
            payment_intent_id=intent.id,
            status=intent.status,
            amount=intent.amount,
            currency=intent.currency,
            item_id=metadata.get("item_id"),
            item_title=metadata.get("item_title"),
            customer_email=intent.receipt_email,
            created=intent.created,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.user_message or str(e),
        )
    except Exception as e:
        logger.exception("Error inesperado al confirmar pago")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get(
    "/api/v1/payments/{payment_intent_id}/status",
    response_model=PaymentStatusResponse,
    tags=["Payments"],
)
async def get_payment_status(payment_intent_id: str):
    try:
        intent = stripe_service.retrieve_payment_intent(payment_intent_id)
        metadata = intent.metadata or {}
        charges = getattr(intent, "charges", None)
        receipt_url = None
        if charges and charges.data and len(charges.data) > 0:
            receipt_url = charges.data[0].receipt_url

        return PaymentStatusResponse(
            payment_intent_id=intent.id,
            status=intent.status,
            amount=intent.amount,
            currency=intent.currency,
            item_id=metadata.get("item_id"),
            item_title=metadata.get("item_title"),
            customer_email=intent.receipt_email,
            receipt_url=receipt_url,
            created=intent.created,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.user_message or "PaymentIntent no encontrado en Stripe.",
        )
    except Exception as e:
        logger.exception("Error al consultar estado de pago")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.post(
    "/api/v1/payments/webhook",
    response_model=WebhookResponse,
    tags=["Webhooks"],
)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
):
    if not stripe_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Falta el encabezado Stripe-Signature requerido",
        )

    payload = await request.body()

    try:
        event = stripe_service.verify_and_construct_webhook_event(payload, stripe_signature)
    except ValueError as e:
        logger.error(f"Error de configuracion de webhook: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Firma de Webhook invalida: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firma de Webhook de Stripe invalida.",
        )
    except Exception as e:
        logger.exception("Error al procesar payload de webhook")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    event_type = event["type"]
    event_data = event["data"]["object"]
    payment_intent_id = event_data.get("id")

    logger.info(f"Evento Stripe recibido: {event_type} para ID: {payment_intent_id}")

    # Logica de negocio segun el evento de Stripe
    if event_type == "payment_intent.succeeded":
        logger.info(
            f"PAGO EXITOSO: Monto={event_data.get('amount')}, "
            f"Item={event_data.get('metadata', {}).get('item_title')}"
        )
        # Aqui se actualizaria el estado del pedido a 'pagado' o 'preparando envio' en la base de datos
    elif event_type == "payment_intent.payment_failed":
        last_error = event_data.get("last_payment_error", {})
        logger.warning(f"PAGO FALLIDO: Motivo={last_error.get('message')}")
    elif event_type == "payment_intent.canceled":
        logger.info(f"PAGO CANCELADO: ID={payment_intent_id}")

    return WebhookResponse(
        received=True,
        event_type=event_type,
        payment_intent_id=payment_intent_id,
    )

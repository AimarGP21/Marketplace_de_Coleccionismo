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
    # Nuevos esquemas de Checkout Alternativo
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    PayLaterRequest,
    PayLaterResponse,
    QRCodeResponse,
    WebhookMockRequest,
    WebhookMockResponse,
    SimulateWebhookDispatchRequest,
    SimulateWebhookDispatchResponse,
)
from app.services.stripe_service import stripe_service
from app.services.checkout_service import checkout_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("payments-api")

app = FastAPI(
    title="Marketplace de Coleccionables - Payments API",
    description="Microservicio de pagos en FastAPI para el Marketplace de Coleccionables con Stripe Sandbox y Flujo de Pagos Alternativos (QR dinámico y BNPL Paga Después).",
    version="1.1.0",
)

# Configuración de CORS amplia para desarrollo local y sandbox
allowed_origins = [
    FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
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
        "version": "1.1.0",
        "features": ["Stripe Sandbox", "Dynamic QR Payments", "Pay Later (BNPL)"],
    }


# ============================================================================
# ENDPOINTS REST: CHECKOUT ALTERNATIVO Y GESTIÓN DE ERRORES
# ============================================================================

@app.post(
    "/api/checkout/session",
    response_model=CheckoutSessionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Alternative Checkout"],
    summary="Crea una sesión de orden de compra en estado PENDING",
)
async def create_checkout_session(req: CheckoutSessionRequest):
    try:
        if req.test_scenario == "simulate_error_500":
            raise RuntimeError("Error interno forzado por simulación de fallo del servidor.")

        if req.amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El monto de la orden debe ser superior a 0.",
            )

        session = checkout_service.create_session(req)
        return session
    except HTTPException:
        raise
    except RuntimeError as e:
        logger.error(f"Error 500 simulado en sesión de checkout: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Error inesperado al crear sesión de checkout")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fallo interno al inicializar orden de checkout: {str(e)}",
        )


@app.get(
    "/api/checkout/qr-code/{order_id}",
    response_model=QRCodeResponse,
    tags=["Alternative Checkout"],
    summary="Genera y retorna el código QR dinámico para pago instantáneo",
)
async def get_checkout_qr_code(order_id: str):
    try:
        qr_info = checkout_service.generate_qr_code(order_id)
        return qr_info
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"La orden con ID '{order_id}' no existe en el sistema.",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La orden '{order_id}' ha expirado o ya no admite pagos: {str(e)}",
        )
    except Exception as e:
        logger.exception("Error al generar código QR")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No fue posible generar el código QR dinámico: {str(e)}",
        )


@app.post(
    "/api/checkout/pay-later",
    response_model=PayLaterResponse,
    tags=["Alternative Checkout"],
    summary="Procesa solicitud de crédito Paga Después (BNPL) con validación de riesgo",
)
async def process_pay_later(req: PayLaterRequest):
    try:
        result = checkout_service.process_pay_later(req)
        return result
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"La orden '{req.order_id}' no fue encontrada.",
        )
    except ValueError as e:
        if str(e) == "ORDER_EXPIRED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La sesión de compra ha expirado. Por favor reinicia el checkout.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Estado de orden inválido: {str(e)}",
        )
    except PermissionError as e:
        code = str(e)
        if code == "INSUFFICIENT_CREDIT_LIMIT":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solicitud rechazada: Fondos o línea de crédito disponible insuficiente.",
            )
        elif code == "INSUFFICIENT_CREDIT_CAPACITY":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solicitud rechazada: El monto de las cuotas excede la capacidad de pago según el ingreso mensual declarado.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solicitud de financiamiento no aprobada tras la evaluación del perfil crediticio.",
            )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error 500 en el motor de scoring crediticio. Intente nuevamente más tarde.",
        )
    except Exception as e:
        logger.exception("Fallo al procesar BNPL")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al procesar crédito BNPL: {str(e)}",
        )


@app.post(
    "/api/checkout/webhook-mock",
    response_model=WebhookMockResponse,
    tags=["Alternative Checkout"],
    summary="Simula la recepción asíncrona de un webhook bancario para QR o pago",
)
async def webhook_mock(req: WebhookMockRequest):
    try:
        resp = checkout_service.process_webhook_mock(req)
        return resp
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"La orden '{req.order_id}' especificada en el webhook no existe.",
        )
    except Exception as e:
        logger.exception("Error en webhook mock")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando webhook mock: {str(e)}",
        )


@app.post(
    "/api/checkout/simulate-webhook-dispatch",
    response_model=SimulateWebhookDispatchResponse,
    tags=["Alternative Checkout"],
    summary="Despacha una petición webhook HTTP POST directamente a la ruta /api/webhooks de Next.js",
)
async def simulate_webhook_dispatch(req: SimulateWebhookDispatchRequest):
    try:
        resp = checkout_service.dispatch_webhook_to_nextjs(req)
        return resp
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"La orden '{req.order_id}' no existe en el sistema.",
        )
    except Exception as e:
        logger.exception("Error al despachar webhook hacia Next.js")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en emisor de webhook: {str(e)}",
        )


@app.get(
    "/api/checkout/order/{order_id}",
    tags=["Alternative Checkout"],
    summary="Consulta el estado detallado de una orden",
)
async def get_order_details(order_id: str):
    order = checkout_service.get_order(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"La orden '{order_id}' no fue encontrada.",
        )
    return order


# ============================================================================
# ENDPOINTS REST: STRIPE SANDBOX (ORIGINALES MANTENIDOS PARA COMPATIBILIDAD)
# ============================================================================

@app.post(
    "/api/v1/payments/create-intent",
    response_model=CreatePaymentIntentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Payments - Stripe"],
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
    tags=["Payments - Stripe"],
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
    tags=["Payments - Stripe"],
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
    tags=["Webhooks - Stripe"],
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

    if event_type == "payment_intent.succeeded":
        logger.info(
            f"PAGO EXITOSO: Monto={event_data.get('amount')}, "
            f"Item={event_data.get('metadata', {}).get('item_title')}"
        )
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

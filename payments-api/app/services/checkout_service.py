import io
import time
import uuid
import json
import base64
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, Optional
import qrcode
from qrcode.image.pil import PilImage

from app.config import FRONTEND_URL
from app.schemas import (
    OrderStatus,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CustomerInfo,
    PayLaterRequest,
    PayLaterResponse,
    InstallmentPlan,
    QRCodeResponse,
    WebhookMockRequest,
    WebhookMockResponse,
    WebhookMockAction,
    SimulateWebhookDispatchRequest,
    SimulateWebhookDispatchResponse,
)

logger = logging.getLogger("payments-api.checkout_service")

# Clave secreta estándar compartida para validación de firma
SHARED_WEBHOOK_SECRET = "relicvault_sandbox_whsec_supersecure_key_2026"

class CheckoutService:
    def __init__(self):
        # Almacenamiento en memoria para prototipado rápido y sandbox
        self.orders: Dict[str, Dict[str, Any]] = {}

    def create_session(self, req: CheckoutSessionRequest) -> CheckoutSessionResponse:
        now = int(time.time())
        order_id = f"ord_{uuid.uuid4().hex[:10]}"
        # TTL por defecto de 15 minutos (900 seg)
        expires_at = now + 900

        order_data = {
            "order_id": order_id,
            "status": OrderStatus.PENDING,
            "amount": req.amount,
            "currency": req.currency,
            "item_id": req.item_id,
            "item_title": req.item_title,
            "customer": req.customer.model_dump(),
            "created_at": now,
            "expires_at": expires_at,
            "payment_method": None,
            "plan": None,
            "logs": [f"[{now}] Orden creada con estado PENDING"],
        }
        self.orders[order_id] = order_data
        logger.info(f"Sesion de checkout creada: {order_id} por monto {req.amount} {req.currency}")

        return CheckoutSessionResponse(
            order_id=order_id,
            status=OrderStatus.PENDING,
            amount=req.amount,
            currency=req.currency,
            item_id=req.item_id,
            item_title=req.item_title,
            customer=req.customer,
            expires_at=expires_at,
            created_at=now,
        )

    def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        order = self.orders.get(order_id)
        if order:
            now = int(time.time())
            # Auto-expirar si superó el tiempo y sigue en PENDING
            if order["status"] == OrderStatus.PENDING and now > order["expires_at"]:
                order["status"] = OrderStatus.EXPIRED
                order["logs"].append(f"[{now}] Orden expirada automáticamente")
        return order

    def generate_qr_code(self, order_id: str) -> QRCodeResponse:
        order = self.get_order(order_id)
        if not order:
            raise KeyError("ORDER_NOT_FOUND")

        now = int(time.time())
        if order["status"] == OrderStatus.EXPIRED or now > order["expires_at"]:
            order["status"] = OrderStatus.EXPIRED
            raise ValueError("ORDER_EXPIRED")

        seconds_remaining = max(0, order["expires_at"] - now)

        # Cadena de pago estándar EMVCo/CoDi/Interbank simulada
        qr_payload = (
            f"relicvault://pay?order_id={order_id}"
            f"&amount={order['amount']:.2f}"
            f"&currency={order['currency']}"
            f"&expires={order['expires_at']}"
        )

        # Generar imagen QR
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(qr_payload)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
        data_uri = f"data:image/png;base64,{img_b64}"

        return QRCodeResponse(
            order_id=order_id,
            status=order["status"],
            qr_data=qr_payload,
            qr_image_base64=data_uri,
            expires_at=order["expires_at"],
            seconds_remaining=seconds_remaining,
            amount=order["amount"],
            currency=order["currency"],
        )

    def process_pay_later(self, req: PayLaterRequest) -> PayLaterResponse:
        order = self.get_order(req.order_id)
        if not order:
            raise KeyError("ORDER_NOT_FOUND")

        now = int(time.time())
        if order["status"] == OrderStatus.EXPIRED or now > order["expires_at"]:
            order["status"] = OrderStatus.EXPIRED
            raise ValueError("ORDER_EXPIRED")

        if order["status"] in [OrderStatus.PAID, OrderStatus.APPROVED]:
            raise ValueError("ORDER_ALREADY_PROCESSED")

        # Escenarios forzados para pruebas
        if req.test_scenario == "insufficient_funds":
            order["status"] = OrderStatus.REJECTED
            order["logs"].append(f"[{now}] BNPL Rechazado: Fondos insuficientes en línea de crédito")
            raise PermissionError("INSUFFICIENT_CREDIT_LIMIT")

        if req.test_scenario == "reject_credit":
            order["status"] = OrderStatus.REJECTED
            order["logs"].append(f"[{now}] BNPL Rechazado: Evaluación crediticia no superada")
            raise PermissionError("CREDIT_CHECK_FAILED")

        if req.test_scenario == "server_error":
            raise RuntimeError("SIMULATED_INTERNAL_SERVER_ERROR")

        # Regla de negocio BNPL:
        installments = req.installments if req.installments in [3, 6, 12] else 3
        rates = {3: 0.0, 6: 0.05, 12: 0.10}
        interest = rates.get(installments, 0.0)
        total_with_interest = round(order["amount"] * (1 + interest), 2)
        monthly_quota = round(total_with_interest / installments, 2)

        max_allowed_quota = req.monthly_income * 0.40
        if monthly_quota > max_allowed_quota:
            order["status"] = OrderStatus.REJECTED
            order["logs"].append(
                f"[{now}] BNPL Rechazado: Cuota ({monthly_quota}) excede el límite del 40% del ingreso ({req.monthly_income})"
            )
            raise PermissionError("INSUFFICIENT_CREDIT_CAPACITY")

        # Aprobación exitosa
        auth_code = f"AUTH-BNPL-{uuid.uuid4().hex[:8].upper()}"
        order["status"] = OrderStatus.APPROVED
        order["payment_method"] = "PAY_LATER_BNPL"
        plan = InstallmentPlan(
            installments=installments,
            monthly_amount=monthly_quota,
            total_amount=total_with_interest,
            interest_rate=interest * 100,
        )
        order["plan"] = plan.model_dump()
        order["logs"].append(f"[{now}] BNPL Aprobado: Código {auth_code} en {installments} cuotas")

        return PayLaterResponse(
            order_id=order["order_id"],
            status=OrderStatus.APPROVED,
            decision="APPROVED",
            plan=plan,
            authorization_code=auth_code,
            reason="Línea de crédito aprobada exitosamente a través de RelicVault Credit.",
        )

    def process_webhook_mock(self, req: WebhookMockRequest) -> WebhookMockResponse:
        order = self.get_order(req.order_id)
        if not order:
            raise KeyError("ORDER_NOT_FOUND")

        now = int(time.time())
        ref = req.payment_reference or f"SPEI-{uuid.uuid4().hex[:6].upper()}"

        if req.action == WebhookMockAction.CONFIRM_PAYMENT:
            order["status"] = OrderStatus.PAID
            order["payment_method"] = "QR_DYNAMIC"
            order["payment_reference"] = ref
            order["logs"].append(f"[{now}] Pago vía QR confirmado mediante webhook. Ref: {ref}")
            msg = f"Pago confirmado con éxito vía QR dinámico. Referencia: {ref}"
        elif req.action == WebhookMockAction.REJECT_PAYMENT:
            order["status"] = OrderStatus.REJECTED
            order["logs"].append(f"[{now}] Pago vía QR rechazado por la entidad bancaria.")
            msg = "Pago rechazado por el banco emisor o fondos insuficientes."
        elif req.action == WebhookMockAction.EXPIRE_ORDER:
            order["status"] = OrderStatus.EXPIRED
            order["logs"].append(f"[{now}] Orden marcada como expirada vía webhook.")
            msg = "Orden expirada por tiempo límite alcanzado."
        else:
            msg = "Acción no reconocida"

        return WebhookMockResponse(
            success=True,
            order_id=order["order_id"],
            new_status=order["status"],
            message=msg,
        )

    def dispatch_webhook_to_nextjs(self, req: SimulateWebhookDispatchRequest) -> SimulateWebhookDispatchResponse:
        """
        Emite una llamada HTTP POST directa al Route Handler /api/webhooks de Next.js
        para cerrar el ciclo asíncrono de vida en desarrollo local y pruebas sandbox.
        """
        order = self.get_order(req.order_id)
        if not order:
            raise KeyError("ORDER_NOT_FOUND")

        now = int(time.time())
        target_url = f"{FRONTEND_URL}/api/webhooks"

        # Construir carga útil simulada
        payload: Dict[str, Any] = {
            "event_type": req.event_type,
            "order_id": req.order_id,
            "status": req.status,
            "timestamp": now,
            "amount": order.get("amount", 0.0),
            "currency": order.get("currency", "USD"),
            "payment_method": order.get("payment_method") or "QR_DYNAMIC",
            "reference": f"EXT-TXN-{uuid.uuid4().hex[:8].upper()}",
            "reason": "Simulación de webhook de pasarela bancaria externa.",
        }

        # Preparar firma de seguridad
        signature = req.custom_signature if req.custom_signature is not None else SHARED_WEBHOOK_SECRET

        # Serializar payload
        if req.simulate_invalid_json:
            data_bytes = b"{ corrupt_json: 'missing_closing_brace' "
        else:
            data_bytes = json.dumps(payload).encode("utf-8")

        headers = {
            "Content-Type": "application/json",
            "x-webhook-signature": signature,
            "User-Agent": "FastAPI-RelicVault-Webhook-Dispatcher/1.0",
        }

        request = urllib.request.Request(target_url, data=data_bytes, headers=headers, method="POST")

        status_code = 0
        response_body = None
        error_msg = None

        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                status_code = response.status
                raw_resp = response.read().decode("utf-8")
                try:
                    response_body = json.loads(raw_resp)
                except Exception:
                    response_body = {"raw": raw_resp}

            # Si el webhook respondió 200, sincronizamos el estado local
            if status_code == 200:
                if req.status == "paid":
                    order["status"] = OrderStatus.PAID
                elif req.status == "rejected":
                    order["status"] = OrderStatus.REJECTED
                elif req.status == "expired":
                    order["status"] = OrderStatus.EXPIRED
                order["logs"].append(f"[{now}] Webhook enviado exitosamente a Next.js (Status {status_code})")

            return SimulateWebhookDispatchResponse(
                success=True,
                status_code=status_code,
                target_url=target_url,
                sent_payload=payload if not req.simulate_invalid_json else None,
                nextjs_response=response_body,
            )

        except urllib.error.HTTPError as http_err:
            status_code = http_err.code
            raw_err = http_err.read().decode("utf-8")
            try:
                response_body = json.loads(raw_err)
            except Exception:
                response_body = {"raw": raw_err}

            return SimulateWebhookDispatchResponse(
                success=False,
                status_code=status_code,
                target_url=target_url,
                sent_payload=payload if not req.simulate_invalid_json else None,
                nextjs_response=response_body,
                error=f"Next.js respondió con error HTTP {status_code}",
            )
        except Exception as ex:
            logger.exception("Error de red conectando con Next.js webhook")
            return SimulateWebhookDispatchResponse(
                success=False,
                status_code=503,
                target_url=target_url,
                sent_payload=payload if not req.simulate_invalid_json else None,
                nextjs_response=None,
                error=f"No se pudo conectar con el frontend en {target_url}: {str(ex)}",
            )

checkout_service = CheckoutService()

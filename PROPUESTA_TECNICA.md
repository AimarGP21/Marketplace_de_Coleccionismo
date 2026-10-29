# 🏛️ RelicVault &bull; Propuesta Técnica y Arquitectura de Pagos Alternativos

**Proyecto:** Marketplace de Coleccionables (RelicVault)  
**Módulos:** Microservicio API (FastAPI) + Aplicación Web Frontend (Next.js 15 / React 19)  
**Versión de Especificación:** 1.2.0  
**Fecha de Publicación:** 2026-10-28  

---

## 1. 🎯 Objetivo del Proyecto

El objetivo primordial de esta iniciativa consiste en transformar y modernizar el flujo de checkout tradicional monoproceso en una **arquitectura desacoplada, resiliente y orientada a eventos**, capaz de soportar:

1. **Métodos de Pago Alternativos (APMs):**
   - Pagos instantáneos mediante **Códigos QR Dinámicos interoperables** (estándares CoDi, SPEI, Pix, EMVCo).
   - Financiamiento inmediato bajo el esquema **"Compre ahora, pague después" (BNPL - Buy Now, Pay Later)** con motor de evaluación de crédito y cálculo dinámico de amortizaciones.
2. **Procesamiento de Eventos Asíncronos:**
   - Desacoplamiento entre la captura de la intención de compra y la liquidación bancaria real mediante **Webhooks con validación criptográfica**.
3. **Experiencia de Usuario de Grado Comercial:**
   - Flujo estructurado paso a paso (*Stepper*) en el cliente frontend.
   - Manejo exhaustivo de estados de error con rutas de recuperación automática (reintentos, degradación elegante y cambio dinámico de método).

---

## 2. 🏗️ Arquitectura del Sistema y Flujo de Datos

El sistema adopta un modelo desacoplado donde la interfaz de usuario interactúa síncronamente con el microservicio para la orquestación y presentación, mientras que la confirmación definitiva de fondos se procesa asíncronamente mediante *Route Handlers* de webhook.

### Diagrama de Flujo y Secuencia (Mermaid)

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as 👤 Comprador
    participant React as 💻 Frontend (Next.js / React)
    participant FastAPI as ⚙️ Microservicio (FastAPI)
    participant Pasarela as 🏦 Pasarela Externa / Banco
    participant WebhookHandler as 🛡️ Webhook Route (/api/webhooks)

    %% Paso 1: Inicialización
    Cliente->>React: Completa datos de envío y confirma resumen
    React->>FastAPI: POST /api/checkout/session (Crear orden PENDING)
    FastAPI-->>React: Retorna order_id (TTL: 15 min)

    %% Paso 2: Selección de Método Alternativo
    alt Opción A: Código QR Dinámico
        React->>FastAPI: GET /api/checkout/qr-code/{order_id}
        FastAPI-->>React: Imagen QR Base64 + tiempo restante
        React->>Cliente: Muestra QR en pantalla con cuenta regresiva
        loop Sondeo periódico (Polling c/ 2.5s)
            React->>FastAPI: GET /api/checkout/order/{order_id}
            FastAPI-->>React: Estado actual (PENDING)
        end
        Cliente->>Pasarela: Escanea y transfiere desde app bancaria
        Pasarela->>FastAPI: Notificación de compensación bancaria
        FastAPI->>WebhookHandler: POST /api/webhooks (x-webhook-signature)
        WebhookHandler->>WebhookHandler: Valida firma criptográfica y payload
        WebhookHandler-->>FastAPI: 200 OK (Acuse de recibo)
        FastAPI->>FastAPI: Actualiza orden a estado PAID
        React->>FastAPI: GET /api/checkout/order/{order_id} (Detección de PAID)
        FastAPI-->>React: Estado PAID + Recibo
    else Opción B: Paga Después (BNPL)
        Cliente->>React: Ingresa documento, ingresos y cuotas (3, 6, 12)
        React->>FastAPI: POST /api/checkout/pay-later
        FastAPI->>FastAPI: Scoring: ¿Cuota <= 40% de ingresos?
        alt Aprobado
            FastAPI-->>React: 200 OK: Estado APPROVED + Código de autorización
        else Rechazado / Fondos Insuficientes
            FastAPI-->>React: 400 Bad Request: Error estructurado
            React->>Cliente: Muestra alerta y sugiere cambiar de método
        end
    end

    %% Paso 3: Confirmación
    React->>Cliente: Muestra Pantalla de Éxito y comprobante digital
```

---

## 3. 💳 Catálogo de Métodos de Pago Alternativos

### 3.1. Cobro con Código QR Dinámico
- **Generación en Backend:** Generado dinámicamente mediante `qrcode[pil]` en FastAPI, empaquetado como imagen PNG Data URI Base64 (`data:image/png;base64,...`) sin necesidad de persistencia en disco ni servidores de archivos externos.
- **Payload Interoperable:** Estructurado bajo esquema URI `relicvault://pay?order_id=...&amount=...&currency=USD&expires=...`.
- **Doble Canal de Sincronización:**
  1. *Sondeo reactivo (Polling):* El cliente consulta cada 2.5 segundos `GET /api/checkout/order/{order_id}` para reflejar de forma inmediata el cambio de estado en pantalla.
  2. *Recepción Asíncrona (Webhook):* Las pasarelas o el emisor de simulación notifican directamente a `POST /api/webhooks` de Next.js.
- **Temporización y TTL:** Ventana de expiración de 15 minutos (900 segundos). Si el contador llega a cero, el microservicio y el cliente cambian automáticamente al estado `EXPIRED`.

### 3.2. Paga Después / Compre Ahora, Pague Después (BNPL)
- **Motor de Evaluación de Capacidad Crediticia:**
  * Análisis en tiempo real de la relación Cuota / Ingreso Mensual declarado:
    $$\text{Ratio de Endeudamiento} = \frac{\text{Cuota Mensual}}{\text{Ingreso Mensual}} \le 0.40 \quad (40\%)$$
  * Si la cuota mensual calculada excede el 40% del ingreso declarado, la solicitud es rechazada preventivamente con código HTTP `400` por capacidad de endeudamiento superada.
- **Planes de Cuotas Flexibles:**
  * **3 Cuotas:** Tasa promocional 0% de interés.
  * **6 Cuotas:** 5% de recargo administrativo/financiero.
  * **12 Cuotas:** 10% de recargo financiero.
- **Emisión de Autorización:** En caso de aprobación, genera un identificador único de autorización `AUTH-BNPL-XXXXXXXX` y transiciona la orden a `APPROVED`.

---

## 4. 🛡️ Estrategia de Resiliencia y Gestión de Errores

### 4.1. Respuestas HTTP Estandarizadas
Tanto el microservicio en FastAPI como el Route Handler de Next.js devuelven respuestas estrictamente formateadas con códigos de estado semánticos:

| Código HTTP | Escenario de Aplicación | Estructura de Respuesta |
| :---: | :--- | :--- |
| **`200 OK`** | Operación exitosa o acuse de recibo de webhook procesado. | JSON con `received: true`, identificador y detalle. |
| **`201 CREATED`** | Creación de sesión de checkout iniciada en estado `PENDING`. | Objeto de sesión con `order_id` y `expires_at`. |
| **`400 BAD REQUEST`** | Transacción rechazada, fondos insuficientes, orden expirada o JSON de webhook malformado. | `{"detail": "Mensaje de rechazo explicativo"}` |
| **`401 UNAUTHORIZED`** | Firma o token de seguridad inválido o ausente en `/api/webhooks`. | `{"error": "Unauthorized", "code": "INVALID_SIGNATURE"}` |
| **`404 NOT FOUND`** | Identificador de orden inexistente o no encontrado en el almacén. | `{"detail": "La orden 'ord_...' no existe en el sistema."}` |
| **`422 UNPROCESSABLE`**| Validación de esquema Pydantic/TypeScript fallida (tipos incorrectos o datos faltantes). | Detalle por campo emitido automáticamente por FastAPI. |
| **`500 SERVER ERROR`** | Excepción no controlada o fallo interno del motor de pagos. | `{"detail": "Fallo interno al procesar transacción"}` |

### 4.2. Tolerancia a Fallos en el Frontend (React)
- **Banner Contextual de Error:** Componente especializado que categoriza visualmente los incidentes en:
  * **Fallo de Red:** Si el microservicio FastAPI se encuentra apagado o no responde, evita bloqueos y muestra una advertencia de conectividad.
  * **Transacción Rechazada:** Explica claramente si el motivo fue score crediticio, saldo insuficiente o rechazo bancario.
  * **Tiempo de Espera Agotado:** Detecta la expiración de la sesión QR e inhabilita intentos de cobro extemporáneos.
- **Mecanismos de Recuperación Activa:**
  * **Botón "Reintentar Operación":** Vuelve a disparar la petición HTTP sin necesidad de refrescar la página ni perder los datos del cliente.
  * **Botón "Cambiar Método de Pago":** Permite al comprador alternar de inmediato entre QR y Paga Después sin reiniciar el stepper.
  * **Botón "Reiniciar Checkout":** Limpia la memoria de la sesión para iniciar una nueva compra segura.

### 4.3. Idempotencia y Procesamiento de Webhooks
- El endpoint `/api/webhooks` valida la cabecera `x-webhook-signature`. Si la firma no coincide con el secreto compartido, la petición es rechazada de inmediato (`401`) antes de ejecutar operaciones costosas.
- Emite un acuse de recibo instantáneo `200 OK` con `correlation_id` para evitar tormentas de reintentos (*retry storms*) por parte de pasarelas externas.

---

## 5. 🚀 Guía de Ejecución Local en Sandbox

### 5.1. Arranque Rápido Simultáneo
Para poner en marcha ambos servicios de forma paralela en tu máquina local, ejecuta en **PowerShell**:

```powershell
.\start-sandbox.ps1
```

O en terminales independientes:
```powershell
# Terminal 1: Microservicio FastAPI (Puerto 8000)
cd payments-api
python run.py

# Terminal 2: Aplicación Web Next.js (Puerto 3000)
cd frontend
npm run dev
```

- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Checkout:** [http://localhost:3000/checkout?id=charizard-psa10](http://localhost:3000/checkout?id=charizard-psa10)
- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Route Handler Webhook:** `http://localhost:3000/api/webhooks`

---

### 5.2. Casos de Prueba de Webhook (Comandos CLI)

#### Caso A: Recepción Exitosa de Webhook (200 OK)
Ejecuta en una terminal PowerShell para simular la confirmación bancaria de una orden:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/webhooks" -Method POST -Headers @{
    "Content-Type" = "application/json"
    "x-webhook-signature" = "relicvault_sandbox_whsec_supersecure_key_2026"
} -Body (@{
    event_type = "payment.qr.confirmed"
    order_id = "ord_demo_test_01"
    status = "paid"
    timestamp = [int][double]::Parse((Get-Date -UFormat %s))
    payment_method = "QR_DYNAMIC"
    amount = 450.00
    currency = "USD"
    reference = "SPEI-998877"
} | ConvertTo-Json)
```
**Respuesta esperada:**
```json
{
  "received": true,
  "correlation_id": "wh_req_...",
  "order_id": "ord_demo_test_01",
  "status": "paid",
  "message": "Evento 'payment.qr.confirmed' procesado correctamente por Next.js."
}
```

---

#### Caso B: Rechazo por Firma Inválida (401 Unauthorized)
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/webhooks" -Method POST -Headers @{
    "Content-Type" = "application/json"
    "x-webhook-signature" = "firma_falsa_o_incorrecta"
} -Body (@{
    event_type = "payment.qr.confirmed"
    order_id = "ord_demo_test_01"
    status = "paid"
    timestamp = 1772150000
} | ConvertTo-Json)
```
**Respuesta esperada:**
```json
HTTP/1.1 401 Unauthorized
{
  "error": "Unauthorized",
  "message": "Firma de webhook inválida o alterada.",
  "code": "INVALID_SIGNATURE"
}
```

---

#### Caso C: Rechazo por Payload Malformado o Campos Faltantes (400 Bad Request)
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/webhooks" -Method POST -Headers @{
    "Content-Type" = "application/json"
    "x-webhook-signature" = "relicvault_sandbox_whsec_supersecure_key_2026"
} -Body (@{
    event_type = "payment.qr.confirmed"
    # Falta order_id y status
} | ConvertTo-Json)
```
**Respuesta esperada:**
```json
HTTP/1.1 400 Bad Request
{
  "error": "Bad Request",
  "message": "Los campos 'event_type', 'order_id' y 'status' son obligatorios.",
  "code": "VALIDATION_FAILED"
}
```

---

### 5.3. Pruebas Interactivas desde el Navegador
1. Abre [http://localhost:3000/checkout?id=charizard-psa10](http://localhost:3000/checkout?id=charizard-psa10).
2. Haz clic en **Continuar a Selección de Método de Pago**.
3. En la sección inferior **Simulador de Escenarios Sandbox**:
   - Pulsa **"Disparar Webhook Válido (200 OK)"** para ver el avance automático a la pantalla de éxito.
   - Pulsa **"Probar Firma Inválida (401)"** o **"Probar JSON Malformado (400)"** para observar la respuesta en consola y en el visor de logs integrado en tiempo real.


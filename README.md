# RelicVault &bull; Marketplace de Coleccionables

Plataforma de comercio electrónico para compra y venta de artículos de colección exclusivos (Cartas TCG graduadas PSA/CGC, monedas numismáticas de oro, cómics clásicos y antigüedades), con pasarela de pagos integrada en modo **Sandbox de Stripe** y microservicio backend de pagos en **FastAPI**.

---

## 🏛️ Arquitectura del Proyecto

El repositorio está organizado como un monorepo con dos módulos principales desacoplados:

```text
Marketplace_de_Coleccionismo/
├── frontend/                       # Aplicación Web en Next.js (App Router + TypeScript + Tailwind)
│   ├── src/
│   │   ├── app/                    # Rutas: Catálogo (/), Checkout (/checkout), Éxito (/success)
│   │   ├── components/             # Componentes: StripeCheckout (PaymentElement), CollectibleCard, Navbar
│   │   ├── data/                   # Artículos de muestra (Charizard PSA 10, Spider-Man AF #15, etc.)
│   │   ├── services/api.ts         # Cliente HTTP para conectar con payments-api
│   │   └── types/                  # Definiciones e interfaces TypeScript
│   ├── .env.example                # Plantilla de variables públicas de Next.js
│   └── package.json
│
├── payments-api/                   # Microservicio REST en FastAPI (Python 3.10+)
│   ├── app/
│   │   ├── main.py                 # Endpoints REST, CORS y router de pagos
│   │   ├── config.py               # Carga y validación segura de variables de entorno
│   │   ├── schemas.py              # Validación de datos y esquemas Pydantic
│   │   └── services/stripe_service.py # Lógica de negocio con el SDK oficial de Stripe
│   ├── .env.example                # Plantilla de variables privadas del microservicio
│   ├── requirements.txt            # Dependencias Python (FastAPI, Uvicorn, Stripe, Pydantic)
│   └── run.py                      # Script de arranque rápido con Uvicorn
│
├── .gitignore                      # Configurado para excluir .env, node_modules, venvs y builds
└── README.md                       # Guía de instalación, configuración y pruebas
```

---

## 🔐 Seguridad y Reglas de Entorno

> [!IMPORTANT]
> **Las credenciales secretas nunca deben subirse al repositorio.**
> Tanto `.env` como `.env.local` y cualquier variación están estrictamente excluidos en `.gitignore`.
> Siempre crea tus archivos locales a partir de los archivos `.env.example`.

### Obtener claves de prueba (Sandbox) de Stripe:
1. Inicia sesión en tu cuenta en el [Dashboard de Stripe](https://dashboard.stripe.com/).
2. Asegúrate de tener activado el switch **"Test mode"** (Modo de prueba).
3. Dirígete a **Desarrolladores > Claves de API**:
   - Copia la **Clave publicable** (`pk_test_...`) para el frontend.
   - Copia la **Clave secreta** (`sk_test_...`) para el microservicio de pagos.

---

## 🚀 Instalación y Puesta en Marcha

### 1. Microservicio Backend (`/payments-api`)

#### Paso 1.1: Crear entorno virtual e instalar dependencias
Abre una terminal en la carpeta `payments-api`:

```bash
cd payments-api

# En Windows (PowerShell):
python -m venv venv
.\venv\Scripts\Activate.ps1

# En Linux / macOS:
python3 -m venv venv
source venv/bin/activate

# Instalar librerías requeridas
pip install -r requirements.txt
```

#### Paso 1.2: Configurar variables de entorno
Copia la plantilla `.env.example` para crear tu `.env`:

```bash
# Windows:
copy .env.example .env

# Linux / macOS:
cp .env.example .env
```

Edita `payments-api/.env` con tus credenciales de Stripe:
```env
STRIPE_SECRET_KEY=sk_test_tu_clave_secreta_aqui
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook_secret_aqui
HOST=0.0.0.0
PORT=8000
FRONTEND_URL=http://localhost:3000
```

#### Paso 1.3: Iniciar la API
```bash
python run.py
```
* La API estará corriendo en: `http://localhost:8000`
* Documentación interactiva Swagger UI: `http://localhost:8000/docs`

---

### 2. Aplicación Frontend (`/frontend`)

#### Paso 2.1: Instalar dependencias
Abre una segunda terminal en la carpeta `frontend`:

```bash
cd frontend
npm install
```

#### Paso 2.2: Configurar variables de entorno
Copia la plantilla `.env.example` a `.env.local`:

```bash
# Windows:
copy .env.example .env.local

# Linux / macOS:
cp .env.example .env.local
```

Edita `frontend/.env.local`:
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_tu_clave_publicable_aqui
NEXT_PUBLIC_PAYMENTS_API_URL=http://localhost:8000
```

#### Paso 2.3: Iniciar el servidor de desarrollo
```bash
npm run dev
```
* El frontend estará disponible en: `http://localhost:3000`

---

## 🧪 Guía de Pruebas

### 1. Flujo de Checkout en Sandbox (Paso a Paso)
1. Con ambos servicios corriendo (`payments-api` en el puerto 8000 y `frontend` en el 3000), abre tu navegador en `http://localhost:3000`.
2. Verás el catálogo de artículos coleccionables de muestra (ej. *Charizard 1st Edition PSA 10*).
3. Haz clic en el botón **"Comprar"** en cualquier coleccionable.
4. El frontend solicitará al microservicio `POST /api/v1/payments/create-intent` y montará el **Stripe Payment Element**.
5. Ingresa cualquier correo electrónico en el campo superior.
6. Utiliza las tarjetas de prueba oficiales de Stripe para simular la compra:

| Escenario de Prueba | Número de Tarjeta | Fecha Exp. | CVC | Código Postal |
| :--- | :--- | :--- | :--- | :--- |
| **Pago Aprobado (Exitoso)** | `4242 4242 4242 4242` | Cualquier fecha futura (ej. `12/28`) | `123` | `90210` o cualquiera |
| **Fondos Insuficientes** | `4000 0000 0000 9995` | Fecha futura | `123` | Cualquiera |
| **Tarjeta Rechazada** | `4000 0000 0000 0002` | Fecha futura | `123` | Cualquiera |

7. Al hacer clic en **"Pagar"**:
   - Con la tarjeta `4242...`, el pago se procesará y se redirigirá a la pantalla `/success?payment_intent=pi_...&item_id=...`.
   - La pantalla de confirmación verificará en tiempo real el estado llamando a `GET /api/v1/payments/{payment_intent_id}/status`.
   - Con tarjetas rechazadas o fondos insuficientes, se mostrará el mensaje de error correspondiente sin salir de la página.

---

### 2. Pruebas de Webhook con Stripe CLI

Para escuchar y validar los eventos de Stripe en tiempo real en tu máquina local:

1. Instala el [Stripe CLI](https://docs.stripe.com/stripe-cli) si aún no lo tienes.
2. Inicia sesión en Stripe desde la terminal:
   ```bash
   stripe login
   ```
3. Reenvía los eventos al microservicio de FastAPI:
   ```bash
   stripe listen --forward-to localhost:8000/api/v1/payments/webhook
   ```
4. Copia el secreto del webhook que imprime la terminal (inicia con `whsec_...`) y colócalo en `payments-api/.env` en la variable `STRIPE_WEBHOOK_SECRET`.
5. En otra terminal, dispara un evento de prueba:
   ```bash
   stripe trigger payment_intent.succeeded
   ```
6. Observa cómo la terminal de `payments-api` registra el log del webhook con firma válida:
   ```text
   INFO:payments-api:Evento Stripe recibido: payment_intent.succeeded para ID: pi_...
   INFO:payments-api:PAGO EXITOSO: Monto=..., Item=...
   ```

---

## 📡 Endpoints del Microservicio (`payments-api`)

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/` | Comprobación de estado y versión del servicio |
| `POST` | `/api/v1/payments/create-intent` | Crea un `PaymentIntent` en Stripe con los metadatos del coleccionable |
| `POST` | `/api/v1/payments/confirm` | Confirma o valida la intención de pago |
| `GET` | `/api/v1/payments/{payment_intent_id}/status` | Obtiene el estado detallado y recibo de una transacción |
| `POST` | `/api/v1/payments/webhook` | Manejador de eventos webhooks de Stripe con validación de firma criptográfica |

---

## 📄 Licencia
Este proyecto es de código abierto bajo la licencia MIT.

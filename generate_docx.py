import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, color_hex):
    """Establece el color de fondo de una celda XML."""
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=140, bottom=140, left=180, right=180):
    """Establece márgenes internos (padding) para la celda."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for margin_name, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{margin_name}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def create_full_document():
    doc = Document()

    # Configuración de márgenes estándar de 1 pulgada (2.54 cm)
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Colores corporativos
    PRIMARY = RGBColor(15, 23, 42)      # Slate 900
    SECONDARY = RGBColor(180, 83, 9)    # Amber 700
    DARK_TEXT = RGBColor(30, 41, 59)    # Slate 800
    MUTED_TEXT = RGBColor(100, 116, 139) # Slate 500
    CODE_COLOR = RGBColor(15, 23, 42)

    # Estilo base
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Calibri'
    style_normal.font.size = Pt(11)
    style_normal.font.color.rgb = DARK_TEXT

    # Helpers
    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.size = Pt(16)
        run.font.bold = True
        run.font.color.rgb = PRIMARY
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.size = Pt(13)
        run.font.bold = True
        run.font.color.rgb = SECONDARY
        return p

    def add_h3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.size = Pt(11)
        run.font.bold = True
        run.font.color.rgb = PRIMARY
        return p

    def add_code_block(code_text):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl.autofit = False
        cell = tbl.cell(0, 0)
        cell.width = Inches(6.5)
        set_cell_background(cell, "F1F5F9")
        set_cell_margins(cell, top=120, bottom=120, left=160, right=160)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        run = p.add_run(code_text)
        run.font.name = 'Consolas'
        run.font.size = Pt(9)
        run.font.color.rgb = CODE_COLOR
        p_spacer = doc.add_paragraph()
        p_spacer.paragraph_format.space_after = Pt(6)

    def add_evidence_box(case_num, title, filename, description):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        tbl.autofit = False
        cell = tbl.cell(0, 0)
        cell.width = Inches(6.5)
        set_cell_background(cell, "FEF3C7") # Fondo ámbar suave
        set_cell_margins(cell, top=160, bottom=160, left=200, right=200)

        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(4)
        r_title = p.add_run(f"📷 CASO {case_num}: {title}\n")
        r_title.font.bold = True
        r_title.font.size = Pt(11)
        r_title.font.color.rgb = RGBColor(146, 64, 14)

        r_file = p.add_run(f"Archivo sugerido: {filename}\n\n")
        r_file.font.italic = True
        r_file.font.size = Pt(9.5)
        r_file.font.color.rgb = RGBColor(180, 83, 9)

        r_ph = p.add_run("[ >>> PEGAR AQUÍ LA CAPTURA DE PANTALLA <<< ]\n\n")
        r_ph.font.bold = True
        r_ph.font.size = Pt(11)
        r_ph.font.color.rgb = RGBColor(185, 28, 28)

        r_desc = p.add_run(f"Leyenda técnica: {description}")
        r_desc.font.size = Pt(9.5)
        r_desc.font.color.rgb = DARK_TEXT

        p_spacer = doc.add_paragraph()
        p_spacer.paragraph_format.space_after = Pt(6)

    # --- 1. PORTADA Y METADATOS ---
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(10)
    title_p.paragraph_format.space_after = Pt(4)
    run_title = title_p.add_run("🏛️ RelicVault • Propuesta Técnica y Arquitectura de Pagos Alternativos")
    run_title.font.size = Pt(22)
    run_title.font.bold = True
    run_title.font.color.rgb = PRIMARY

    subtitle_p = doc.add_paragraph()
    subtitle_p.paragraph_format.space_after = Pt(14)
    run_sub = subtitle_p.add_run("Arquitectura de Checkout Desacoplada, Métodos de Pago Alternativos (QR & BNPL) y Webhooks Asíncronos")
    run_sub.font.size = Pt(12)
    run_sub.font.italic = True
    run_sub.font.color.rgb = SECONDARY

    meta_table = doc.add_table(rows=4, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False

    meta_data = [
        ("Proyecto:", "Marketplace de Coleccionables (RelicVault)"),
        ("Módulos:", "Microservicio API (FastAPI) + Aplicación Web Frontend (Next.js 15 / React 19)"),
        ("Versión de Especificación:", "2.0.0 (Consolidada y Acumulativa)"),
        ("Autoría:", "Arquitectura de Software e Ingeniería Full-Stack"),
    ]

    for i, (label, val) in enumerate(meta_data):
        row = meta_table.rows[i]
        c0, c1 = row.cells[0], row.cells[1]
        c0.width = Inches(2.2)
        c1.width = Inches(4.3)
        set_cell_background(c0, "F1F5F9")
        set_cell_background(c1, "F8FAFC")
        set_cell_margins(c0, top=100, bottom=100, left=140, right=140)
        set_cell_margins(c1, top=100, bottom=100, left=140, right=140)

        p0 = c0.paragraphs[0]
        p0.paragraph_format.space_after = Pt(0)
        r0 = p0.add_run(label)
        r0.font.bold = True
        r0.font.size = Pt(10)
        r0.font.color.rgb = PRIMARY

        p1 = c1.paragraphs[0]
        p1.paragraph_format.space_after = Pt(0)
        r1 = p1.add_run(val)
        r1.font.size = Pt(10)
        r1.font.color.rgb = DARK_TEXT

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # --- SECCIÓN 1: INVESTIGACIÓN TEÓRICA PRELIMINAR ---
    add_h1("1. Investigación Teórica Preliminar")
    doc.add_paragraph(
        "El diseño e implementación de sistemas transaccionales y de pagos en el comercio electrónico contemporáneo "
        "exige patrones arquitectónicos rigurosos para garantizar integridad, seguridad, disponibilidad y resiliencia "
        "ante contingencias operativas. A continuación, se detallan los tres pilares teóricos y metodológicos que sustentan la solución desarrollada:"
    )

    add_h2("1.1. Webhooks y Arquitectura Orientada a Eventos frente al Sondeo Periódico (Polling)")
    doc.add_paragraph(
        "En plataformas convencionales, la verificación del estado de una transacción suele implementarse mediante sondeo periódico "
        "(polling), donde el cliente efectúa consultas continuas a intervalos regulares (GET /status) esperando el cambio de estado. "
        "Este modelo presenta deficiencias estructurales críticas:"
    )
    for b_title, b_desc in [
        ("Consumo Excesivo de Recursos:", " Una tasa elevada de peticiones simultáneas sin cambio de estado satura conexiones, eleva costos de CPU y congestiona la base de datos con lecturas redundantes."),
        ("Latencia Innecesaria:", " El comprador percibe la confirmación con un retraso correspondiente a la ventana del ciclo de muestreo."),
        ("Falta de Idoneidad para Procesos Asíncronos Desacoplados:", " Las transferencias interbancarias (SPEI, CoDi, Pix) poseen tiempos de compensación variables e indeterminados."),
    ]:
        bp = doc.add_paragraph(style='List Bullet')
        bp.paragraph_format.space_after = Pt(3)
        r_bt = bp.add_run(b_title)
        r_bt.font.bold = True
        bp.add_run(b_desc)

    doc.add_paragraph(
        "Los Webhooks (llamadas inversas HTTP orientadas a eventos) invierten el flujo (Push vs. Pull): la pasarela notifica "
        "directamente al receptor mediante HTTP POST inmediatamente al suscitarse el evento. La arquitectura resuelve tres retos clave:"
    )
    for b_title, b_desc in [
        ("Idempotencia Transaccional:", " Registro de identificadores únicos (order_id, correlation_id) para evitar cobros dobles o duplicidad contable ante retransmisiones de red."),
        ("Acuse de Recibo Inmediato:", " Respuesta HTTP 200 OK sin demoras tras la validación formal, delegando tareas pesadas a segundo plano para prevenir timeouts del emisor."),
        ("Mitigación de Tormentas de Reintentos (Retry Storms):", " Respuestas inmediatas y limpias que evitan que la pasarela active reintentos exponenciales que saturen los servidores."),
    ]:
        bp = doc.add_paragraph(style='List Bullet')
        bp.paragraph_format.space_after = Pt(3)
        r_bt = bp.add_run(b_title)
        r_bt.font.bold = True
        bp.add_run(b_desc)

    add_h2("1.2. Tokens Transaccionales, Firmas Criptográficas y Prevención de Ataques de Repetición")
    doc.add_paragraph(
        "Los endpoints de webhook están abiertos a Internet y expuestos a spoofing y adulteración de payloads. "
        "Se adoptó un modelo de seguridad por secreto compartido:"
    )
    for b_title, b_desc in [
        ("Cabecera de Firma (x-webhook-signature):", " El emisor genera un hash criptográfico HMAC-SHA256 de la carga útil con su clave secreta."),
        ("Verificación de Integridad en el Receptor:", " La ruta /api/webhooks recalcula el resumen criptográfico sobre los bytes exactos recibidos; ante cualquier discordancia, aborta con HTTP 401 Unauthorized."),
        ("Prevención de Ataques de Repetición (Replay Attacks):", " El payload incluye una estampa de tiempo (timestamp). Se rechazan peticiones con diferencia temporal mayor a 300 segundos respecto al reloj del servidor."),
    ]:
        bp = doc.add_paragraph(style='List Bullet')
        bp.paragraph_format.space_after = Pt(3)
        r_bt = bp.add_run(b_title)
        r_bt.font.bold = True
        bp.add_run(b_desc)

    add_h2("1.3. Manejo de Excepciones Semánticas y Resiliencia en Arquitecturas Desacopladas")
    doc.add_paragraph(
        "A nivel Backend (FastAPI + Pydantic), se establece una semántica estricta: HTTP 400 (Fondos insuficientes o crédito rechazado), "
        "401 (Firma inválida), 404 (Orden no hallada), 422 (Fallo de validación Pydantic) y 500 (Error del runtime). "
        "A nivel Frontend (React 19), la interfaz absorbe los fallos desplegando banners de contención enriquecidos "
        "y suministrando rutas de recuperación directa (Reintentar operación, Cambiar método o Reiniciar checkout)."
    )

    # --- SECCIÓN 2: OBJETIVO DEL PROYECTO ---
    add_h1("2. Objetivo del Proyecto")
    doc.add_paragraph(
        "El objetivo primordial de esta iniciativa consiste en transformar y modernizar el flujo de checkout tradicional monoproceso "
        "en una arquitectura desacoplada, resiliente y orientada a eventos, capaz de soportar:"
    )
    for b_title, b_desc in [
        ("Métodos de Pago Alternativos (APMs):", " Pagos instantáneos mediante Códigos QR Dinámicos interoperables (CoDi, SPEI, Pix, EMVCo) y financiamiento Paga Después (BNPL)."),
        ("Procesamiento de Eventos Asíncronos:", " Desacoplamiento entre la captura de intención de compra y la liquidación bancaria real mediante Webhooks con validación criptográfica."),
        ("Experiencia de Usuario de Grado Comercial:", " Flujo estructurado paso a paso (Stepper) en el cliente frontend y manejo exhaustivo de estados de error con recuperación automática."),
    ]:
        bp = doc.add_paragraph(style='List Bullet')
        bp.paragraph_format.space_after = Pt(3)
        r_bt = bp.add_run(b_title)
        r_bt.font.bold = True
        bp.add_run(b_desc)

    # --- SECCIÓN 3: ARQUITECTURA DEL SISTEMA Y FLUJO DE DATOS ---
    add_h1("3. Arquitectura del Sistema y Flujo de Datos")
    doc.add_paragraph(
        "El sistema adopta un modelo desacoplado donde la interfaz de usuario interactúa síncronamente con el microservicio "
        "para la orquestación y presentación, mientras que la confirmación definitiva de fondos se procesa asíncronamente "
        "mediante Route Handlers de webhook."
    )

    add_h2("3.1. Diagrama de Secuencia y Flujo Transaccional (Mermaid)")
    mermaid_code = (
        "sequenceDiagram\n"
        "    autonumber\n"
        "    actor Cliente as Comprador\n"
        "    participant React as Frontend (Next.js / React)\n"
        "    participant FastAPI as Microservicio (FastAPI)\n"
        "    participant Pasarela as Pasarela Externa / Banco\n"
        "    participant WebhookHandler as Webhook Route (/api/webhooks)\n\n"
        "    %% Paso 1: Inicializacion\n"
        "    Cliente->>React: Completa datos de envio y confirma resumen\n"
        "    React->>FastAPI: POST /api/checkout/session (Crear orden PENDING)\n"
        "    FastAPI-->>React: Retorna order_id (TTL: 15 min)\n\n"
        "    %% Paso 2: Seleccion de Metodo Alternativo\n"
        "    alt Opcion A: Codigo QR Dinamico\n"
        "        React->>FastAPI: GET /api/checkout/qr-code/{order_id}\n"
        "        FastAPI-->>React: Imagen QR Base64 + tiempo restante\n"
        "        React->>Cliente: Muestra QR en pantalla con cuenta regresiva\n"
        "        loop Sondeo periodico (Polling c/ 2.5s)\n"
        "            React->>FastAPI: GET /api/checkout/order/{order_id}\n"
        "            FastAPI-->>React: Estado actual (PENDING)\n"
        "        end\n"
        "        Cliente->>Pasarela: Escanea y transfiere desde app bancaria\n"
        "        Pasarela->>FastAPI: Notificacion de compensacion bancaria\n"
        "        FastAPI->>WebhookHandler: POST /api/webhooks (x-webhook-signature)\n"
        "        WebhookHandler->>WebhookHandler: Valida firma criptografica y payload\n"
        "        WebhookHandler-->>FastAPI: 200 OK (Acuse de recibo)\n"
        "        FastAPI->>FastAPI: Actualiza orden a estado PAID\n"
        "        React->>FastAPI: GET /api/checkout/order/{order_id} (Deteccion de PAID)\n"
        "        FastAPI-->>React: Estado PAID + Recibo\n"
        "    else Opcion B: Paga Despues (BNPL)\n"
        "        Cliente->>React: Ingresa documento, ingresos y cuotas (3, 6, 12)\n"
        "        React->>FastAPI: POST /api/checkout/pay-later\n"
        "        FastAPI->>FastAPI: Scoring: ¿Cuota <= 40% de ingresos?\n"
        "        alt Aprobado\n"
        "            FastAPI-->>React: 200 OK: Estado APPROVED + Codigo autorizacion\n"
        "        else Rechazado / Fondos Insuficientes\n"
        "            FastAPI-->>React: 400 Bad Request: Error estructurado\n"
        "            React->>Cliente: Muestra alerta y sugiere cambiar metodo\n"
        "        end\n"
        "    end\n\n"
        "    %% Paso 3: Confirmacion\n"
        "    React->>Cliente: Muestra Pantalla de Exito y comprobante digital"
    )
    add_code_block(mermaid_code)

    # --- SECCIÓN 4: CATÁLOGO DE MÉTODOS DE PAGO ALTERNATIVOS ---
    add_h1("4. Catálogo de Métodos de Pago Alternativos")

    add_h2("4.1. Cobro con Código QR Dinámico")
    for b_title, b_desc in [
        ("Generación en Backend:", " Generado dinámicamente mediante qrcode[pil] en FastAPI, empaquetado como imagen PNG Data URI Base64 (data:image/png;base64,...) sin necesidad de persistencia en disco."),
        ("Payload Interoperable:", " Estructurado bajo esquema URI relicvault://pay?order_id=...&amount=...&currency=USD&expires=..."),
        ("Doble Canal de Sincronización:", " 1) Sondeo reactivo (Polling) cada 2.5s vía GET /api/checkout/order/{order_id}. 2) Recepción Asíncrona (Webhook) vía POST /api/webhooks en Next.js."),
        ("Temporización y TTL:", " Ventana de expiración de 15 minutos (900 segundos). Si el contador llega a cero, el estado pasa automáticamente a EXPIRED."),
    ]:
        bp = doc.add_paragraph(style='List Bullet')
        bp.paragraph_format.space_after = Pt(3)
        r_bt = bp.add_run(b_title)
        r_bt.font.bold = True
        bp.add_run(b_desc)

    add_h2("4.2. Paga Después / Compre Ahora, Pague Después (BNPL)")
    doc.add_paragraph(
        "Motor de evaluación de capacidad crediticia: Análisis en tiempo real de la relación Cuota / Ingreso Mensual declarado:"
    )
    p_eq = doc.add_paragraph()
    r_eq = p_eq.add_run("Ratio de Endeudamiento = (Cuota Mensual / Ingreso Mensual) <= 0.40  (40%)")
    r_eq.font.bold = True
    r_eq.font.color.rgb = SECONDARY

    doc.add_paragraph(
        "Si la cuota mensual supera el 40% del ingreso declarado, la solicitud es rechazada preventivamente con HTTP 400. "
        "Planes de cuotas: 3 cuotas (0% interés), 6 cuotas (+5% recargo) y 12 cuotas (+10% recargo), emitiendo el folio AUTH-BNPL-XXXXXXXX."
    )

    # --- SECCIÓN 5: ESTRATEGIA DE RESILIENCIA Y GESTIÓN DE ERRORES ---
    add_h1("5. Estrategia de Resiliencia y Gestión de Errores")

    add_h2("5.1. Respuestas HTTP Estandarizadas")
    err_table = doc.add_table(rows=8, cols=3)
    err_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    err_table.autofit = False

    headers = ["Código HTTP", "Escenario de Aplicación", "Estructura de Respuesta"]
    for j, h in enumerate(headers):
        c = err_table.rows[0].cells[j]
        set_cell_background(c, "0F172A")
        set_cell_margins(c, top=120, bottom=120, left=140, right=140)
        p = c.paragraphs[0]
        r = p.add_run(h)
        r.font.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(255, 255, 255)

    err_rows = [
        ("200 OK", "Operación exitosa o acuse de recibo de webhook.", "JSON con received: true, correlation_id y detalle."),
        ("201 CREATED", "Creación de sesión de checkout en estado PENDING.", "Objeto de sesión con order_id y expires_at."),
        ("400 BAD REQUEST", "Transacción rechazada, fondos insuficientes o webhook malformado.", "{\"detail\": \"Mensaje de rechazo explicativo\"}"),
        ("401 UNAUTHORIZED", "Firma o token de seguridad inválido en /api/webhooks.", "{\"error\": \"Unauthorized\", \"code\": \"INVALID_SIGNATURE\"}"),
        ("404 NOT FOUND", "Identificador de orden inexistente o expirado.", "{\"detail\": \"La orden 'ord_...' no existe en el sistema.\"}"),
        ("422 UNPROCESSABLE", "Validación Pydantic/TypeScript fallida por campos o tipos inválidos.", "Detalle de error semántico por campo emitido por FastAPI."),
        ("500 SERVER ERROR", "Excepción no controlada o fallo interno del motor de pagos.", "{\"detail\": \"Fallo interno al procesar transacción\"}"),
    ]

    for i, (code, scn, beh) in enumerate(err_rows):
        row = err_table.rows[i + 1]
        c0, c1, c2 = row.cells[0], row.cells[1], row.cells[2]
        c0.width = Inches(1.5)
        c1.width = Inches(2.3)
        c2.width = Inches(2.7)
        bg = "F8FAFC" if i % 2 == 0 else "FFFFFF"
        for c in [c0, c1, c2]:
            set_cell_background(c, bg)
            set_cell_margins(c, top=100, bottom=100, left=120, right=120)

        p0 = c0.paragraphs[0]
        r0 = p0.add_run(code)
        r0.font.bold = True
        r0.font.size = Pt(9.5)

        p1 = c1.paragraphs[0]
        r1 = p1.add_run(scn)
        r1.font.size = Pt(9.5)

        p2 = c2.paragraphs[0]
        r2 = p2.add_run(beh)
        r2.font.size = Pt(9.5)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    add_h2("5.2. Tolerancia a Fallos en el Frontend (React)")
    doc.add_paragraph(
        "La interfaz categoriza visualmente los incidentes en: Fallo de Red, Transacción Rechazada y Tiempo de Espera Agotado. "
        "Ofrece tres botones de acción inmediata: Reintentar Operación, Cambiar Método de Pago y Reiniciar Checkout."
    )

    add_h2("5.3. Idempotencia y Procesamiento de Webhooks")
    doc.add_paragraph(
        "El endpoint /api/webhooks valida la cabecera x-webhook-signature contra la clave compartida antes de cualquier cómputo. "
        "Emite un acuse inmediato 200 OK con correlation_id para neutralizar tormentas de reintentos por parte de pasarelas externas."
    )

    # --- SECCIÓN 6: GUÍA DE EJECUCIÓN LOCAL EN SANDBOX ---
    add_h1("6. Guía de Ejecución Local en Sandbox")
    add_h2("6.1. Arranque Rápido Simultáneo")
    doc.add_paragraph("Para iniciar ambos servicios concurrentemente, ejecute en PowerShell:")
    add_code_block(".\\start-sandbox.ps1")
    doc.add_paragraph(
        "Endpoints activos:\n"
        "• Frontend Web: http://localhost:3000\n"
        "• Checkout con Stepper: http://localhost:3000/checkout?id=charizard-psa10\n"
        "• Swagger UI (FastAPI): http://localhost:8000/docs\n"
        "• Route Handler de Webhooks: http://localhost:3000/api/webhooks"
    )

    add_h2("6.2. Casos de Prueba de Webhook (Comandos CLI)")

    add_h3("Caso A: Recepción Exitosa de Webhook (200 OK)")
    cmd_a = (
        "Invoke-RestMethod -Uri \"http://localhost:3000/api/webhooks\" -Method POST -Headers @{\n"
        "    \"Content-Type\" = \"application/json\"\n"
        "    \"x-webhook-signature\" = \"relicvault_sandbox_whsec_supersecure_key_2026\"\n"
        "} -Body (@{\n"
        "    event_type = \"payment.qr.confirmed\"\n"
        "    order_id = \"ord_demo_test_01\"\n"
        "    status = \"paid\"\n"
        "    timestamp = [int][double]::Parse((Get-Date -UFormat %s))\n"
        "    payment_method = \"QR_DYNAMIC\"\n"
        "    amount = 450.00\n"
        "    currency = \"USD\"\n"
        "    reference = \"SPEI-998877\"\n"
        "} | ConvertTo-Json)"
    )
    add_code_block(cmd_a)
    doc.add_paragraph("Respuesta esperada:")
    resp_a = (
        "{\n"
        "  \"received\": true,\n"
        "  \"correlation_id\": \"wh_req_...\",\n"
        "  \"order_id\": \"ord_demo_test_01\",\n"
        "  \"status\": \"paid\",\n"
        "  \"message\": \"Evento 'payment.qr.confirmed' procesado correctamente por Next.js.\"\n"
        "}"
    )
    add_code_block(resp_a)

    add_h3("Caso B: Rechazo por Firma Inválida (401 Unauthorized)")
    cmd_b = (
        "Invoke-RestMethod -Uri \"http://localhost:3000/api/webhooks\" -Method POST -Headers @{\n"
        "    \"Content-Type\" = \"application/json\"\n"
        "    \"x-webhook-signature\" = \"firma_falsa_o_incorrecta\"\n"
        "} -Body (@{\n"
        "    event_type = \"payment.qr.confirmed\"\n"
        "    order_id = \"ord_demo_test_01\"\n"
        "    status = \"paid\"\n"
        "    timestamp = 1772150000\n"
        "} | ConvertTo-Json)"
    )
    add_code_block(cmd_b)
    doc.add_paragraph("Respuesta esperada:")
    resp_b = (
        "HTTP/1.1 401 Unauthorized\n"
        "{\n"
        "  \"error\": \"Unauthorized\",\n"
        "  \"message\": \"Firma de webhook inválida o alterada.\",\n"
        "  \"code\": \"INVALID_SIGNATURE\"\n"
        "}"
    )
    add_code_block(resp_b)

    add_h3("Caso C: Rechazo por Payload Malformado o Campos Faltantes (400 Bad Request)")
    cmd_c = (
        "Invoke-RestMethod -Uri \"http://localhost:3000/api/webhooks\" -Method POST -Headers @{\n"
        "    \"Content-Type\" = \"application/json\"\n"
        "    \"x-webhook-signature\" = \"relicvault_sandbox_whsec_supersecure_key_2026\"\n"
        "} -Body (@{\n"
        "    event_type = \"payment.qr.confirmed\"\n"
        "    # Falta order_id y status\n"
        "} | ConvertTo-Json)"
    )
    add_code_block(cmd_c)
    doc.add_paragraph("Respuesta esperada:")
    resp_c = (
        "HTTP/1.1 400 Bad Request\n"
        "{\n"
        "  \"error\": \"Bad Request\",\n"
        "  \"message\": \"Los campos 'event_type', 'order_id' y 'status' son obligatorios.\",\n"
        "  \"code\": \"VALIDATION_FAILED\"\n"
        "}"
    )
    add_code_block(resp_c)

    add_h2("6.3. Pruebas Interactivas desde el Navegador")
    doc.add_paragraph(
        "1. Abra http://localhost:3000/checkout?id=charizard-psa10\n"
        "2. Haga clic en 'Continuar a Selección de Método de Pago'.\n"
        "3. En la sección inferior 'Simulador de Escenarios Sandbox':\n"
        "   • Pulse 'Disparar Webhook Válido (200 OK)' para observar el avance automático a la pantalla de éxito.\n"
        "   • Pulse 'Probar Firma Inválida (401)' o 'Probar JSON Malformado (400)' para inspeccionar el registro de rechazo en consola y visor de logs."
    )

    # --- SECCIÓN 7: EVIDENCIAS DE EJECUCIÓN Y VALIDACIÓN EXPERIMENTAL ---
    add_h1("7. Evidencias de Ejecución y Validación Experimental")
    doc.add_paragraph(
        "A continuación se presentan los seis casos de prueba obligatorios validados en el entorno de desarrollo local. "
        "Cada bloque cuenta con su descripción técnica formal y su espacio designado para insertar la captura correspondiente:"
    )

    add_evidence_box(
        case_num=1,
        title="Generación de Código QR Interoperable",
        filename="Comercio_1.png",
        description="Generación exitosa del código QR dinámico mediante GET /api/checkout/qr-code/{order_id} en FastAPI, renderizado en Next.js con cuenta regresiva regresiva activa (TTL de 15 minutos)."
    )

    add_evidence_box(
        case_num=2,
        title="Sondeo Reactivo en Segundo Plano (Polling)",
        filename="Comercio_3.png",
        description="Inspección de red en DevTools del navegador evidenciando las consultas periódicas emitidas cada 2.5s hacia GET /api/checkout/order/{order_id} con respuestas HTTP 200 OK y estado PENDING."
    )

    add_evidence_box(
        case_num=3,
        title="Financiamiento Paga Después (BNPL) y Desglose de Cuotas",
        filename="Comercio_4.png",
        description="Formulario de solicitud de crédito evaluando en vivo el ingreso mensual declarado y desplegando el desglose dinámico en planes de 3 (0%), 6 (+5%) y 12 (+10%) cuotas."
    )

    add_evidence_box(
        case_num=4,
        title="Manejo de Excepciones y Pantallas de Error en UI",
        filename="Comercio_6.png",
        description="Banner contextual de error ante respuesta HTTP 400 Bad Request por fondos insuficientes o scoring no superado, destacando los botones interactivos de 'Reintentar operación' y 'Cambiar método de pago'."
    )

    add_evidence_box(
        case_num=5,
        title="Simulación y Respuesta del Route Handler de Webhooks",
        filename="Comercio_7.png",
        description="Consola de ejecución registrando el despacho del evento firmado desde FastAPI hacia POST /api/webhooks en Next.js, su validación de firma y el acuse de recibo HTTP 200 OK con correlation_id."
    )

    add_evidence_box(
        case_num=6,
        title="Confirmación Final y Transición a Éxito",
        filename="Comercio_5.png",
        description="Pantalla de confirmación de compra exitosa con recibo comercial completo, identificador de orden, método utilizado y desglose de amortizaciones o referencia de transferencia."
    )

    output_path = r"C:\Users\User\Desktop\Github\Marketplace_de_Coleccionismo\PROPUESTA_TECNICA.docx"
    doc.save(output_path)
    print(f"Documento DOCX regenerado exitosamente en: {output_path}")

if __name__ == "__main__":
    create_full_document()

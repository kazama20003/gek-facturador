# Emitec

Librería y plataforma de **comprobantes electrónicos para Perú** (motor para el SEE — Sistema del Contribuyente), construida con **NestJS + TypeScript** aplicando **DDD con dominio puro y arquitectura hexagonal**.

**Etapa actual (6):** facturas + **notas de crédito (07) y débito (08)** — pipeline completo dominio → XML UBL 2.1 → firma → ZIP → SUNAT beta → CDR, con persistencia de facturas. **Verificado contra el beta real: factura F001-1, NC F001-1 y ND F001-1 aceptadas con CDR limpio (ResponseCode 0).**

## Alcance actual

| Soportado | No soportado todavía |
| --- | --- |
| Factura gravada básica (tipo 01, operación 0101, forma de pago Contado) | Boletas y resumen diario, guías |
| Notas de crédito (07, catálogo 09) y débito (08, catálogo 10) por `sendBill` | Persistencia de notas, comunicación de baja |
| XML UBL 2.1 firmado (XML-DSig), certificados PEM y **PFX/PKCS#12** | Pago a crédito con cuotas |
| Validación well-formed + XSD (OASIS UBL 2.1) | PDF, resúmenes/bajas |
| Persistencia PostgreSQL/Prisma (estado + CDR) | Listados/consultas avanzadas |
| ZIP `RUC-01-SERIE-CORRELATIVO.zip` + `sendBill` (SOAP) + CDR parseado | Endpoint de producción certificado |
| PEN y USD | Descuentos, anticipos, detracciones, exoneradas/inafectas |

> Solo entorno **beta/homologación** de SUNAT. Emitec no es (todavía) un PSE ni una integración certificada.

## Estructura

```
src/
├── invoice/
│   ├── domain/                  # puro — sin NestJS, class-validator ni infraestructura
│   │   ├── aggregates/          # Invoice (aggregate root, totales derivados)
│   │   ├── entities/            # InvoiceItem (calcula base, IGV, precio, total)
│   │   ├── value-objects/       # Money, Ruc, InvoiceSeries, Correlative, Quantity,
│   │   │                        # Currency, IgvAffectationType, Party
│   │   ├── errors/              # DomainError específicos
│   │   └── services/            # tasa IGV (18%)
│   ├── application/
│   │   └── use-cases/           # CreateInvoiceUseCase (comando primitivo → resultado serializable)
│   ├── infrastructure/          # (vacío en esta etapa)
│   ├── presentation/
│   │   └── http/                # InvoiceController, DomainErrorFilter (422)
│   │       └── dto/             # CreateInvoiceDto (class-validator)
│   └── invoice.module.ts
└── shared/
    └── domain/                  # DomainError base
```

## Decisiones

- **`decimal.js`** para todo cálculo monetario; los importes entran como cadenas (`Money.pen('100.00')`).
- Redondeo **HALF-UP a 2 decimales** en cada monto derivado.
- `Ruc` valida el **dígito verificador** (módulo 11 de SUNAT).
- Los códigos SUNAT (`01` factura, `10` gravada onerosa) viven dentro de VOs/constantes, no como strings mágicos.
- Sin repositorios ni persistencia aún: el use case retorna el resultado directamente.

## Uso

```bash
pnpm install
pnpm start:dev
```

`POST /invoices`:

```json
{
  "series": "F001",
  "correlative": 1,
  "issueDate": "2026-08-20",
  "currency": "PEN",
  "issuer": { "ruc": "20000000001", "businessName": "EMITEC SAC" },
  "customer": { "ruc": "20100070970", "businessName": "CLIENTE SAC" },
  "items": [
    { "code": "SERV-001", "description": "Servicio de transporte", "unitCode": "ZZ", "quantity": "1", "unitValue": "100.00" }
  ]
}
```

Respuesta: totales calculados por el dominio (`100.00` + IGV `18.00` = `118.00`). Errores de formato → 400; violaciones de reglas de dominio → 422.

## XML UBL 2.1 (endpoints temporales de desarrollo)

Para generar el XML el emisor debe incluir `tradeName` (opcional) y `address` (obligatorio):

```json
"issuer": {
  "ruc": "20000000001",
  "businessName": "EMITEC SAC",
  "tradeName": "EMITEC",
  "address": {
    "ubigeo": "150101",
    "department": "LIMA",
    "province": "LIMA",
    "district": "LIMA",
    "addressLine": "AV. EJEMPLO 123"
  }
}
```

- `POST /invoices/xml` → XML UBL 2.1 **sin firmar** como `application/xml`.
- `POST /invoices/xml/validate` → `{ xml, validation }` del XML sin firmar (reporta la desviación esperada de `ExtensionContent` vacío).
- `POST /invoices/xml/signed` → XML **firmado** (XML-DSig) como `application/xml`.
- `POST /invoices/xml/signed/validate` → `{ xml, validation }` del firmado — **valida al 100 % contra el XSD, cero errores**.

### Firma digital

- Firma **enveloped XML-DSig**: `ds:Signature` con `Id="IDSignSP"` dentro de `ext:ExtensionContent`, coincidiendo con la referencia declarativa `cac:Signature` (`#IDSignSP`).
- Algoritmos: **RSA-SHA256**, digest SHA-256, C14N inclusivo + transform enveloped-signature. Determinista (RSASSA-PKCS1 v1.5).
- Certificado: variables `SIGN_KEY_PATH` / `SIGN_CERT_PATH` (PEM). Sin configurar, usa el **certificado de prueba autofirmado** de `test/fixtures/certs/` (CN "NO USAR EN PRODUCCION") y lo advierte por consola. Sirve para desarrollo y el beta de SUNAT; producción requiere certificado tributario vigente. La clave de prueba commiteada no es un secreto; nunca commitear claves reales.

Ejemplo con curl:

```bash
curl -s -X POST http://localhost:3000/invoices/xml \
  -H "Content-Type: application/json" -d @factura.json
```

### Validación estructural

Niveles de validación (esta etapa cubre solo 1 y 2):

1. XML bien formado ✔
2. XML válido contra XSD ✔
3. Reglas de negocio SUNAT (solo las básicas del dominio)
4. Aceptación real por SUNAT ✖ (etapas futuras)

- **XSD:** OASIS UBL 2.1 oficial (`docs.oasis-open.org/ubl/os-UBL-2.1/xsd`), vendorizados en `resources/xsd/`. Versión: UBL 2.1 OS (noviembre 2013, la referenciada por las guías SUNAT vigentes).
- **Reglas SUNAT de referencia:** guía de elaboración de factura electrónica UBL 2.1 y catálogos publicados en `cpe.sunat.gob.pe/guias-y-manuales` (consultados 2026-08).
- **Motor:** `libxml2-wasm` ejecutado en un proceso hijo (`scripts/validate-ubl-xsd.mjs`). Decisión técnica: es ESM-only (incompatible con el runtime CommonJS/Jest del proyecto) y el proceso aislado además contiene el parser. Configurado sin red (`XML_PARSE_NONET`), sin sustitución de entidades y sin acceso a archivos fuera de `resources/xsd` → sin XXE.
- **Desviación del XML sin firmar (resuelta al firmar):** `ext:ExtensionContent` vacío produce 1 error de XSD; el XML **firmado** valida al 100 % con cero errores (cubierto por tests).

## Pruebas

```bash
pnpm test        # unitarias (dominio, use cases, generador XML, conversor a letras, validador XSD)
pnpm test:e2e    # endpoints HTTP + comparación estructural con Greenter
pnpm lint
pnpm build
```

Incluye una prueba **golden file** (`test/fixtures/invoice-f001-1.golden.xml`) y una comparación estructural con la salida de [Greenter](https://github.com/thegreenter/xml) (MIT, usado solo como referencia de verificación).

## Envío a SUNAT (beta)

- `POST /invoices/sunat/send` (endpoint dev) → firma, empaqueta y envía por `sendBill`; devuelve `{ fileName, cdr, cdrZipBase64, signedXml }`.
- Config por entorno: `SUNAT_ENDPOINT` (default beta `e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService`), `SUNAT_SOL_USERNAME` (RUC+usuario, default `20000000001MODDATOS` para beta), `SUNAT_SOL_PASSWORD` (default `moddatos`).
- Certificado PFX: `SIGN_PFX_PATH` + `SIGN_PFX_PASSWORD` (tiene prioridad sobre los PEM).
- CDR: se extrae `R-*.xml` del ZIP de respuesta; `responseCode 0` = aceptada, `>=2000` rechazo, notas = observaciones. El parser usa extracción tolerante porque los CDR reales de SUNAT no son namespace-limpios (parsers DOM estrictos los rechazan).
- Errores SOAP (`faultcode` numérico SUNAT, ej. 0111, 2335) se lanzan como `SunatSoapFaultError`.
- Hallazgos aplicados de la verificación en vivo: `cac:PaymentTerms` FormaPago/Contado es obligatorio (error 3244, R.S. 193-2020) y `listName` de `InvoiceTypeCode` debe ser "Tipo de Documento" (observación 4252).

## Persistencia

- **PostgreSQL + Prisma 6**. Esquema en `prisma/schema.prisma` (tablas snake_case singular: `invoice`, `invoice_item`; FK `id_invoice`). Migración inicial en `prisma/migrations/0001_init`.
- Arranque: `docker compose up -d` (Postgres local) → copiar `.env.example` a `.env` → `pnpm exec prisma migrate deploy` → `pnpm start:dev`.
- **Sin `DATABASE_URL` la app usa un repositorio en memoria** (volátil, con advertencia) — útil para desarrollo rápido; los tests nunca tocan la base.
- El dominio no conoce Prisma: puerto `InvoiceRepository` + mapper que reconstruye el agregado re-ejecutando sus invariantes.
- Flujo persistido:
  1. `POST /invoices` — guarda; serie+correlativo duplicado para el mismo emisor → **409**.
  2. `GET /invoices/:id` — estado (`ISSUED`/`ACCEPTED`/`REJECTED`) + datos del CDR; desconocida → **404**.
  3. `POST /invoices/:id/sunat/send` — envía a SUNAT y guarda CDR, XML firmado y estado.

## Notas de crédito y débito (endpoints dev)

Mismo cuerpo que la factura más `reasonCode` (catálogo 09 para NC, 10 para ND; ej. `"01"` = anulación / intereses por mora), `reasonDescription` opcional y `modifies` (factura referenciada):

```json
{ "series": "F001", "correlative": 1, "reasonCode": "01",
  "modifies": { "series": "F001", "correlative": 1 }, "...": "resto igual a factura" }
```

- `POST /credit-notes/sunat/send` y `POST /debit-notes/sunat/send` → firman, empaquetan (`RUC-07/08-SERIE-CORR.zip`), envían y devuelven el CDR.
- `POST /credit-notes/xml/signed` y `POST /debit-notes/xml/signed` → XML UBL firmado (`CreditNote`/`DebitNote`; ND usa `RequestedMonetaryTotal` según el XSD).
- Motivo inválido para el catálogo → 422. Las notas aún no se persisten.

## Próximas etapas

1. Boletas (tipo 03, receptor con DNI) + resumen diario (`sendSummary`/`getStatus`) y comunicación de baja.
2. Persistencia de notas; PDF; pago a crédito con cuotas; homologación hacia producción.

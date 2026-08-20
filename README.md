# Emitec

Librería y plataforma de **comprobantes electrónicos para Perú** (motor para el SEE — Sistema del Contribuyente), construida con **NestJS + TypeScript** aplicando **DDD con dominio puro y arquitectura hexagonal**.

**Etapa actual (2):** dominio de factura gravada básica + generación de **XML UBL 2.1** con validación estructural (XSD).

## Alcance actual

| Soportado | No soportado todavía |
| --- | --- |
| Factura gravada básica (tipo 01, operación 0101) | Boletas, notas de crédito/débito, guías |
| XML UBL 2.1 **sin firmar** | Firma digital, certificados PFX |
| Validación well-formed + XSD (OASIS UBL 2.1) | Envío SOAP a SUNAT, CDR, PDF, persistencia |
| PEN y USD | Descuentos, anticipos, detracciones, exoneradas/inafectas |

> El XML generado **no está firmado** y **no se envía a SUNAT**. Emitec no es (todavía) un PSE ni una integración certificada.

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

- `POST /invoices/xml` → devuelve el XML UBL 2.1 **sin firmar** como `application/xml`.
- `POST /invoices/xml/validate` → devuelve `{ xml, validation }` con el resultado de la validación XSD.

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
- **Desviación conocida:** el XML sin firmar deja `ext:ExtensionContent` vacío (reservado para `ds:Signature`); el XSD exige un hijo ahí, así que la validación reporta exactamente ese único error hasta la etapa de firma. Sin ese nodo, el documento valida al 100 % (cubierto por tests).

## Pruebas

```bash
pnpm test        # unitarias (dominio, use cases, generador XML, conversor a letras, validador XSD)
pnpm test:e2e    # endpoints HTTP + comparación estructural con Greenter
pnpm lint
pnpm build
```

Incluye una prueba **golden file** (`test/fixtures/invoice-f001-1.golden.xml`) y una comparación estructural con la salida de [Greenter](https://github.com/thegreenter/xml) (MIT, usado solo como referencia de verificación).

## Próximas etapas

1. Firma digital (ds:Signature dentro de `ext:ExtensionContent`, certificado PFX).
2. Empaquetado ZIP y comunicación SOAP con SUNAT (SEE del Contribuyente) + lectura del CDR.
3. Persistencia, boletas, notas de crédito/débito, guías de remisión.

# Emitec

Librería y plataforma de **comprobantes electrónicos para Perú** (motor para el SEE — Sistema del Contribuyente), construida con **NestJS + TypeScript** aplicando **DDD con dominio puro y arquitectura hexagonal**.

**Etapa actual:** dominio de una factura electrónica gravada básica. Sin XML UBL, firma, SOAP/SUNAT, base de datos ni PDF todavía.

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

## Pruebas

```bash
pnpm test        # unitarias (dominio + use case)
pnpm test:e2e    # endpoint
pnpm lint
pnpm build
```

## Próximas etapas

1. XML UBL 2.1 y firma digital.
2. Comunicación SOAP con SUNAT (SEE del Contribuyente).
3. Persistencia, boletas, notas de crédito/débito, guías de remisión.

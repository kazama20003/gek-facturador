# Facturación Backend

Backend de **facturación electrónica** (estilo [greenter](https://greenter.dev/)) construido con **NestJS + TypeScript**, aplicando **DDD puro en el dominio** y **arquitectura pragmática en la infraestructura**.

## Stack

- **NestJS 11** — framework HTTP / inyección de dependencias
- **PostgreSQL + Prisma** — persistencia
- **class-validator** — validación de contratos HTTP
- **Jest** — pruebas

## Arquitectura

Organización por **bounded context**. Cada contexto tiene tres capas:

```
src/
├── shared/                         # kernel compartido
│   ├── domain/                     # DominioException
│   └── infrastructure/             # PrismaModule/Service, filtros HTTP
└── contexts/
    └── facturacion/                # bounded context
        ├── domain/                 # DDD puro — sin dependencias de framework
        │   ├── entities/           # Comprobante (raíz de agregado), ComprobanteDetalle
        │   ├── value-objects/      # Ruc, Serie, Dinero
        │   ├── enums/              # TipoComprobante, EstadoComprobante, Moneda
        │   └── repositories/       # puertos (interfaces) + token DI
        ├── application/            # casos de uso (1 caso = 1 responsabilidad)
        │   ├── crear-comprobante/
        │   └── buscar-comprobante/
        └── infrastructure/         # adaptadores (pragmático)
            ├── http/               # controllers, DTOs, presenters
            └── persistence/        # repositorio Prisma + mapper
```

### Reglas arquitectónicas

- **Domain no depende de infraestructura** — no importa Nest, Prisma ni HTTP.
- **Controllers no contienen lógica de negocio** — traducen request → caso de uso → respuesta.
- **Use cases representan acciones del negocio** — uno por responsabilidad.
- **Módulos separados por bounded context.**
- **El código expresa el negocio antes que la tecnología** (nombres en español).

El dominio se traduce a/desde la base de datos vía **mappers**; nunca se filtran tipos de Prisma al dominio.

## Convenciones

| Elemento     | Convención            | Ejemplo                     |
| ------------ | --------------------- | --------------------------- |
| Clases       | PascalCase            | `CrearComprobanteUseCase`   |
| Variables    | camelCase             | `fechaEmision`              |
| Métodos      | camelCase             | `ejecutar()`, `aceptar()`   |
| Archivos     | kebab-case            | `crear-comprobante.use-case.ts` |
| Constantes   | UPPER_SNAKE_CASE      | `PORCENTAJE_IGV`            |
| Enums        | PascalCase            | `EstadoComprobante`         |
| Tablas SQL   | snake_case, singular  | `comprobante`, `comprobante_detalle` |
| Columnas     | snake_case            | `fecha_emision`, `ruc_emisor` |
| Llave foránea| `id_entidad`          | `id_comprobante`            |

## Puesta en marcha

```bash
pnpm install
cp .env.example .env          # completar DATABASE_URL
pnpm prisma:generate
pnpm prisma:migrate           # crea el esquema en PostgreSQL
pnpm start:dev
```

## Endpoints

Prefijo global: `/api`

| Método | Ruta                 | Descripción                  |
| ------ | -------------------- | ---------------------------- |
| POST   | `/api/comprobantes`  | Emitir un comprobante        |
| GET    | `/api/comprobantes/:id` | Consultar por id          |

Ejemplo de emisión:

```json
POST /api/comprobantes
{
  "tipo": "01",
  "serie": "F001",
  "moneda": "PEN",
  "rucEmisor": "20123456789",
  "docReceptor": "10456789012",
  "nombreReceptor": "Cliente SAC",
  "detalles": [
    { "descripcion": "Servicio de flete", "cantidad": 2, "precioUnitario": 100 }
  ]
}
```

El correlativo se asigna automáticamente por serie. El IGV (18%) y los totales se calculan en el dominio.

## Pruebas

```bash
pnpm test           # unitarias (dominio)
pnpm test:cov       # con cobertura
```

## Próximos pasos

- Migración inicial de Prisma (`prisma migrate dev`).
- Generación de XML UBL 2.1 y firma digital (núcleo SUNAT, como greenter).
- Casos de uso: anular comprobante, notas de crédito/débito.
- Autenticación / autorización.

import { Module } from '@nestjs/common';
import { BuscarComprobanteUseCase } from './application/buscar-comprobante/buscar-comprobante.use-case';
import { CrearComprobanteUseCase } from './application/crear-comprobante/crear-comprobante.use-case';
import { COMPROBANTE_REPOSITORY } from './domain/repositories/comprobante.repository';
import { ComprobanteController } from './infrastructure/http/comprobante.controller';
import { PrismaComprobanteRepository } from './infrastructure/persistence/prisma-comprobante.repository';

/** Bounded context: Facturación electrónica. */
@Module({
  controllers: [ComprobanteController],
  providers: [
    CrearComprobanteUseCase,
    BuscarComprobanteUseCase,
    // El caso de uso depende del puerto (interface); aquí se enlaza a la implementación.
    { provide: COMPROBANTE_REPOSITORY, useClass: PrismaComprobanteRepository },
  ],
})
export class FacturacionModule {}

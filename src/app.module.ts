import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FacturacionModule } from './contexts/facturacion/facturacion.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    FacturacionModule,
  ],
})
export class AppModule {}

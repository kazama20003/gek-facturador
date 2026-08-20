import { Injectable } from '@nestjs/common';
import { Comprobante } from '../../domain/entities/comprobante.entity';
import { ComprobanteRepository } from '../../domain/repositories/comprobante.repository';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ComprobanteMapper } from './comprobante.mapper';

/** Implementación del puerto ComprobanteRepository sobre PostgreSQL/Prisma. */
@Injectable()
export class PrismaComprobanteRepository implements ComprobanteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async guardar(comprobante: Comprobante): Promise<Comprobante> {
    const fila = await this.prisma.comprobante.create({
      data: ComprobanteMapper.aPersistencia(comprobante),
      include: { detalles: true },
    });
    return ComprobanteMapper.aDominio(fila);
  }

  async buscarPorId(id: string): Promise<Comprobante | null> {
    const fila = await this.prisma.comprobante.findUnique({
      where: { id },
      include: { detalles: true },
    });
    return fila ? ComprobanteMapper.aDominio(fila) : null;
  }

  async existeSerieCorrelativo(serie: string, correlativo: number): Promise<boolean> {
    const cuenta = await this.prisma.comprobante.count({
      where: { serie, correlativo },
    });
    return cuenta > 0;
  }

  async siguienteCorrelativo(serie: string): Promise<number> {
    const ultimo = await this.prisma.comprobante.findFirst({
      where: { serie },
      orderBy: { correlativo: 'desc' },
      select: { correlativo: true },
    });
    return (ultimo?.correlativo ?? 0) + 1;
  }
}

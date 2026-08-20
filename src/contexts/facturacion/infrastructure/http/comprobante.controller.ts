import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { BuscarComprobanteUseCase } from '../../application/buscar-comprobante/buscar-comprobante.use-case';
import { CrearComprobanteUseCase } from '../../application/crear-comprobante/crear-comprobante.use-case';
import { ComprobantePresenter } from './comprobante.presenter';
import { CrearComprobanteRequest } from './dtos/crear-comprobante.request';

/** Adaptador HTTP. Sin lógica de negocio: solo traduce request -> caso de uso -> respuesta. */
@Controller('comprobantes')
export class ComprobanteController {
  constructor(
    private readonly crearComprobante: CrearComprobanteUseCase,
    private readonly buscarComprobante: BuscarComprobanteUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() body: CrearComprobanteRequest) {
    const comprobante = await this.crearComprobante.ejecutar(body);
    return ComprobantePresenter.aRespuesta(comprobante);
  }

  @Get(':id')
  async obtener(@Param('id') id: string) {
    const comprobante = await this.buscarComprobante.ejecutar(id);
    return ComprobantePresenter.aRespuesta(comprobante);
  }
}

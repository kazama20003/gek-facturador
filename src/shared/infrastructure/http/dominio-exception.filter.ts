import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { DominioException } from '../../domain/dominio.exception';

/**
 * Traduce violaciones de reglas de negocio (DominioException) a HTTP 422.
 * Mantiene al dominio ignorante de HTTP.
 */
@Catch(DominioException)
export class DominioExceptionFilter implements ExceptionFilter {
  catch(exception: DominioException, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    respuesta.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      error: exception.name,
      message: exception.message,
    });
  }
}

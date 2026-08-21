import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DuplicateInvoiceError,
  DuplicateNoteError,
  InvoiceNotFoundError,
  NoteNotFoundError,
} from '../../domain/errors/invoice-errors';
import { DomainError } from '../../../shared/domain/domain-error';

/**
 * Maps domain errors to HTTP, keeping the domain HTTP-agnostic:
 * not found → 404, duplicate → 409, any other rule violation → 422.
 */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const isNotFound =
      exception instanceof InvoiceNotFoundError ||
      exception instanceof NoteNotFoundError;
    const isConflict =
      exception instanceof DuplicateInvoiceError ||
      exception instanceof DuplicateNoteError;
    const status = isNotFound
      ? HttpStatus.NOT_FOUND
      : isConflict
        ? HttpStatus.CONFLICT
        : HttpStatus.UNPROCESSABLE_ENTITY;

    response.status(status).json({
      statusCode: status,
      error: exception.name,
      message: exception.message,
    });
  }
}

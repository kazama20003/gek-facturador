import { DomainError } from '../../../shared/domain/domain-error';

export class InvalidMoneyError extends DomainError {}

export class CurrencyMismatchError extends DomainError {}

export class InvalidRucError extends DomainError {}

export class InvalidInvoiceSeriesError extends DomainError {}

export class InvalidCorrelativeError extends DomainError {}

export class InvalidQuantityError extends DomainError {}

export class InvoiceWithoutItemsError extends DomainError {
  constructor() {
    super('An invoice cannot be issued without items.');
  }
}

export class InvalidInvoiceItemError extends DomainError {}

export class InvalidPartyError extends DomainError {}

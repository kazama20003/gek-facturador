import { InvalidIdentityDocumentError } from '../errors/invoice-errors';
import { Ruc } from './ruc';

/**
 * Identity document of a party (SUNAT catalog 06).
 * Supported: RUC (code 6, with check digit) and DNI (code 1, 8 digits).
 */
export class IdentityDocument {
  private constructor(
    /** SUNAT catalog 06 code: '6' = RUC, '1' = DNI. */
    readonly code: '6' | '1',
    private readonly value: string,
  ) {}

  static ruc(value: string): IdentityDocument {
    return new IdentityDocument('6', Ruc.create(value).toString());
  }

  static dni(value: string): IdentityDocument {
    const trimmed = value?.trim() ?? '';
    if (!/^\d{8}$/.test(trimmed)) {
      throw new InvalidIdentityDocumentError(
        `DNI must be exactly 8 digits: "${value}".`,
      );
    }
    return new IdentityDocument('1', trimmed);
  }

  get isRuc(): boolean {
    return this.code === '6';
  }

  toString(): string {
    return this.value;
  }
}

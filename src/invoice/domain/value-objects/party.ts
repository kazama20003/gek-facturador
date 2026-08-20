import { InvalidPartyError } from '../errors/invoice-errors';
import { Ruc } from './ruc';

/** A party in the invoice (issuer or customer): RUC plus registered business name. */
export class Party {
  private constructor(
    readonly ruc: Ruc,
    readonly businessName: string,
  ) {}

  static create(params: { ruc: Ruc; businessName: string }): Party {
    const businessName = params.businessName?.trim() ?? '';
    if (businessName.length === 0) {
      throw new InvalidPartyError('Business name is required.');
    }
    return new Party(params.ruc, businessName);
  }
}

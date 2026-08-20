import { InvalidPartyError } from '../errors/invoice-errors';
import { Address } from './address';
import { Ruc } from './ruc';

/**
 * A party in the invoice (issuer or customer). Trade name and fiscal address
 * are optional at creation time; XML generation requires the issuer to carry
 * a complete address (enforced by the mapper, never silently defaulted).
 */
export class Party {
  private constructor(
    readonly ruc: Ruc,
    readonly businessName: string,
    readonly tradeName: string | undefined,
    readonly address: Address | undefined,
  ) {}

  static create(params: {
    ruc: Ruc;
    businessName: string;
    tradeName?: string;
    address?: Address;
  }): Party {
    const businessName = params.businessName?.trim() ?? '';
    if (businessName.length === 0) {
      throw new InvalidPartyError('Business name is required.');
    }
    return new Party(
      params.ruc,
      businessName,
      params.tradeName?.trim() || undefined,
      params.address,
    );
  }
}

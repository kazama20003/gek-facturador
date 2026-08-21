import { InvalidPartyError } from '../errors/invoice-errors';
import { Address } from './address';
import { IdentityDocument } from './identity-document';
import { Ruc } from './ruc';

/**
 * A party in the document. Issuers always identify with RUC; customers may
 * use RUC (invoices) or DNI (boletas). Trade name and fiscal address are
 * optional; XML generation requires the issuer to carry a complete address.
 */
export class Party {
  private constructor(
    readonly identity: IdentityDocument,
    readonly businessName: string,
    readonly tradeName: string | undefined,
    readonly address: Address | undefined,
  ) {}

  /** RUC-identified party (issuers, invoice customers). */
  static create(params: {
    ruc: Ruc;
    businessName: string;
    tradeName?: string;
    address?: Address;
  }): Party {
    return Party.withIdentity({
      identity: IdentityDocument.ruc(params.ruc.toString()),
      businessName: params.businessName,
      tradeName: params.tradeName,
      address: params.address,
    });
  }

  static withIdentity(params: {
    identity: IdentityDocument;
    businessName: string;
    tradeName?: string;
    address?: Address;
  }): Party {
    const businessName = params.businessName?.trim() ?? '';
    if (businessName.length === 0) {
      throw new InvalidPartyError('Business name is required.');
    }
    return new Party(
      params.identity,
      businessName,
      params.tradeName?.trim() || undefined,
      params.address,
    );
  }

  /** RUC of the party. Only valid for RUC-identified parties (e.g. issuers). */
  get ruc(): Ruc {
    if (!this.identity.isRuc) {
      throw new InvalidPartyError('Party is not identified with a RUC.');
    }
    return Ruc.create(this.identity.toString());
  }
}

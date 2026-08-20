import { InvalidPartyError } from '../errors/invoice-errors';

/**
 * Peruvian fiscal address. Ubigeo is the 6-digit INEI geographic code.
 * All fields are required when an address is provided — SUNAT rejects
 * invoices with incomplete issuer addresses.
 */
export class Address {
  private constructor(
    readonly ubigeo: string,
    readonly department: string,
    readonly province: string,
    readonly district: string,
    readonly addressLine: string,
  ) {}

  static create(params: {
    ubigeo: string;
    department: string;
    province: string;
    district: string;
    addressLine: string;
  }): Address {
    const ubigeo = params.ubigeo?.trim() ?? '';
    if (!/^\d{6}$/.test(ubigeo)) {
      throw new InvalidPartyError(
        `Ubigeo must be exactly 6 digits: "${params.ubigeo}".`,
      );
    }
    const required: Array<[string, string]> = [
      ['department', params.department],
      ['province', params.province],
      ['district', params.district],
      ['addressLine', params.addressLine],
    ];
    for (const [field, value] of required) {
      if ((value?.trim() ?? '').length === 0) {
        throw new InvalidPartyError(`Address field "${field}" is required.`);
      }
    }
    return new Address(
      ubigeo,
      params.department.trim(),
      params.province.trim(),
      params.district.trim(),
      params.addressLine.trim(),
    );
  }
}

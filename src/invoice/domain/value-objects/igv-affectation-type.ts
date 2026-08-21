import { InvalidInvoiceItemError } from '../errors/invoice-errors';

/** SUNAT catalog 05 tax metadata attached to an affectation. */
export interface TaxScheme {
  readonly id: string;
  readonly name: string;
  readonly internationalCode: string;
}

/**
 * IGV affectation type (SUNAT catalog 07). SUNAT codes live inside the value
 * object so they never travel through the domain as magic strings. Each
 * onerous affectation carries its catalog-05 tax scheme.
 */
export class IgvAffectationType {
  /** Operación gravada onerosa — code 10, IGV 18%. */
  static readonly TAXED_OPERATION = new IgvAffectationType(
    '10',
    'Taxed operation',
    true,
    {
      id: '1000',
      name: 'IGV',
      internationalCode: 'VAT',
    },
  );

  /** Operación exonerada onerosa — code 20, no IGV. */
  static readonly EXONERATED = new IgvAffectationType(
    '20',
    'Exonerated operation',
    false,
    {
      id: '9997',
      name: 'EXO',
      internationalCode: 'VAT',
    },
  );

  /** Operación inafecta onerosa — code 30, no IGV. */
  static readonly UNAFFECTED = new IgvAffectationType(
    '30',
    'Unaffected operation',
    false,
    {
      id: '9998',
      name: 'INA',
      internationalCode: 'FRE',
    },
  );

  /** Transferencia gratuita gravada — code 11, referential IGV (catalog 05: 9996 GRA). */
  static readonly FREE_TAXED = new IgvAffectationType(
    '11',
    'Free taxed transfer',
    true,
    {
      id: '9996',
      name: 'GRA',
      internationalCode: 'FRE',
    },
    true,
  );

  private constructor(
    readonly sunatCode: string,
    readonly description: string,
    readonly appliesIgv: boolean,
    readonly taxScheme: TaxScheme,
    readonly isFree: boolean = false,
  ) {}

  static fromCode(code: string): IgvAffectationType {
    const match = [
      IgvAffectationType.TAXED_OPERATION,
      IgvAffectationType.EXONERATED,
      IgvAffectationType.UNAFFECTED,
      IgvAffectationType.FREE_TAXED,
    ].find((a) => a.sunatCode === code);
    if (!match) {
      throw new InvalidInvoiceItemError(
        `Unsupported IGV affectation code "${code}" (supported: 10, 20, 30, 11).`,
      );
    }
    return match;
  }

  isTaxed(): boolean {
    return this.appliesIgv;
  }
}

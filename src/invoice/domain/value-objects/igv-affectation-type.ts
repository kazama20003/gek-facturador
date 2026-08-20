/**
 * IGV affectation type (SUNAT catalog 07). The SUNAT code lives inside the
 * value object so it never travels through the domain as a magic string.
 */
export class IgvAffectationType {
  /** Operación gravada onerosa — SUNAT code 10. */
  static readonly TAXED_OPERATION = new IgvAffectationType(
    '10',
    'Taxed operation',
  );

  private constructor(
    readonly sunatCode: string,
    readonly description: string,
  ) {}

  isTaxed(): boolean {
    return this === IgvAffectationType.TAXED_OPERATION;
  }
}

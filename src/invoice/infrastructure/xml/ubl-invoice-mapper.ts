import { Invoice } from '../../domain/aggregates/invoice';
import { InvalidPartyError } from '../../domain/errors/invoice-errors';
import { IgvAffectationType } from '../../domain/value-objects/igv-affectation-type';
import type { AmountInWordsConverter } from '../../application/ports/amount-in-words-converter.port';
import { igvAffectationCode, IGV_PERCENT } from './ubl-catalog-mapper';

/** One cac:TaxTotal subtotal per affectation category present in the invoice. */
function buildTaxSubtotals(invoice: Invoice): UblTaxSubtotal[] {
  const groups: Array<{ base: string; tax: string; type: IgvAffectationType }> =
    [
      {
        base: invoice.taxableAmount.toFixed(),
        tax: invoice.igv.toFixed(),
        type: IgvAffectationType.TAXED_OPERATION,
      },
      {
        base: invoice.exoneratedAmount.toFixed(),
        tax: '0.00',
        type: IgvAffectationType.EXONERATED,
      },
      {
        base: invoice.unaffectedAmount.toFixed(),
        tax: '0.00',
        type: IgvAffectationType.UNAFFECTED,
      },
      {
        base: invoice.freeAmount.toFixed(),
        tax: invoice.freeIgv.toFixed(),
        type: IgvAffectationType.FREE_TAXED,
      },
    ];
  return groups
    .filter((g) => g.base !== '0.00')
    .map((g) => ({
      taxableAmount: g.base,
      taxAmount: g.tax,
      tax: {
        id: g.type.taxScheme.id,
        name: g.type.taxScheme.name,
        internationalCode: g.type.taxScheme.internationalCode,
      },
    }));
}

export interface UblAddress {
  readonly ubigeo: string;
  readonly department: string;
  readonly province: string;
  readonly district: string;
  readonly addressLine: string;
}

export interface UblLine {
  readonly number: number;
  readonly quantity: string;
  readonly unitCode: string;
  readonly taxableAmount: string;
  readonly unitPriceWithIgv: string;
  readonly igvAmount: string;
  readonly igvPercent: string;
  readonly affectationCode: string;
  readonly tax: {
    readonly id: string;
    readonly name: string;
    readonly internationalCode: string;
  };
  readonly description: string;
  readonly code?: string;
  /** Net unit value used in cac:Price (after line discount). */
  readonly unitValue: string;
  /** '01' unit price incl. IGV (onerous) | '02' referential value (free). */
  readonly priceTypeCode: string;
  readonly isFree: boolean;
  /** Line discount amount ('0.00' if none). */
  readonly discount: string;
  /** Gross line amount (unitValue × quantity) — AllowanceCharge base. */
  readonly discountBase: string;
}

/** A tax subtotal grouped by affectation category, for cac:TaxTotal. */
export interface UblTaxSubtotal {
  readonly taxableAmount: string;
  readonly taxAmount: string;
  readonly tax: {
    readonly id: string;
    readonly name: string;
    readonly internationalCode: string;
  };
}

/**
 * Immutable projection of the Invoice aggregate, built exclusively through
 * its public query methods. Everything the XML generator needs, nothing more.
 */
export interface UblInvoiceDocument {
  readonly id: string;
  /** SUNAT catalog 01: '01' factura, '03' boleta. */
  readonly documentType: string;
  /** SUNAT catalog 51 operation type (0101 internal sale, 1001+ detraction). */
  readonly operationType: string;
  readonly issueDate: string;
  readonly issueTime: string;
  readonly currency: string;
  readonly amountInWords: string;
  readonly issuer: {
    readonly ruc: string;
    readonly businessName: string;
    readonly tradeName?: string;
    readonly address: UblAddress;
  };
  readonly customer: {
    /** SUNAT catalog 06: '6' RUC, '1' DNI. */
    readonly docCode: string;
    readonly docNumber: string;
    readonly businessName: string;
  };
  readonly taxableAmount: string;
  readonly exoneratedAmount: string;
  readonly unaffectedAmount: string;
  readonly freeAmount: string;
  readonly freeIgv: string;
  readonly globalDiscount: string;
  readonly lineExtensionTotal: string;
  readonly igv: string;
  readonly saleValue: string;
  readonly total: string;
  readonly taxSubtotals: ReadonlyArray<UblTaxSubtotal>;
  readonly payment: UblPayment;
  readonly detraction?: {
    readonly code: string;
    readonly percent: string;
    readonly account: string;
    readonly amount: string;
  };
  readonly lines: ReadonlyArray<UblLine>;
}

export interface UblPayment {
  readonly isCredit: boolean;
  readonly pendingAmount?: string;
  readonly installments: ReadonlyArray<{
    readonly id: string;
    readonly amount: string;
    readonly dueDate: string;
  }>;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isoTime(date: Date): string {
  return date.toISOString().slice(11, 19);
}

/** Maps the aggregate to the UBL projection. Read-only: never mutates the invoice. */
export class UblInvoiceMapper {
  constructor(private readonly amountInWords: AmountInWordsConverter) {}

  map(invoice: Invoice): UblInvoiceDocument {
    const address = invoice.issuer.address;
    if (!address) {
      throw new InvalidPartyError(
        'Issuer fiscal address (ubigeo, department, province, district, address line) is required to generate the UBL XML.',
      );
    }

    return {
      id: `${invoice.series.toString()}-${invoice.correlative.toNumber()}`,
      documentType: invoice.documentType,
      operationType: invoice.detraction
        ? invoice.detraction.operationType
        : '0101',
      issueDate: isoDate(invoice.issueDate),
      issueTime: isoTime(invoice.issueDate),
      currency: invoice.currency,
      amountInWords: this.amountInWords.convert(invoice.total),
      issuer: {
        ruc: invoice.issuer.ruc.toString(),
        businessName: invoice.issuer.businessName,
        tradeName: invoice.issuer.tradeName,
        address: {
          ubigeo: address.ubigeo,
          department: address.department,
          province: address.province,
          district: address.district,
          addressLine: address.addressLine,
        },
      },
      customer: {
        docCode: invoice.customer.identity.code,
        docNumber: invoice.customer.identity.toString(),
        businessName: invoice.customer.businessName,
      },
      taxableAmount: invoice.taxableAmount.toFixed(),
      exoneratedAmount: invoice.exoneratedAmount.toFixed(),
      unaffectedAmount: invoice.unaffectedAmount.toFixed(),
      freeAmount: invoice.freeAmount.toFixed(),
      freeIgv: invoice.freeIgv.toFixed(),
      globalDiscount: invoice.globalDiscount.toFixed(),
      lineExtensionTotal: invoice.lineExtensionTotal.toFixed(),
      igv: invoice.igv.toFixed(),
      saleValue: invoice.saleValue.toFixed(),
      total: invoice.total.toFixed(),
      taxSubtotals: buildTaxSubtotals(invoice),
      detraction: invoice.detraction
        ? {
            code: invoice.detraction.code,
            percent: invoice.detraction.percent,
            account: invoice.detraction.account,
            amount: invoice.detraction.amount.toFixed(),
          }
        : undefined,
      payment: {
        isCredit: invoice.paymentTerms.isCredit,
        pendingAmount: invoice.paymentTerms.pendingAmount?.toFixed(),
        installments: invoice.paymentTerms.installments.map((i) => ({
          id: i.id,
          amount: i.amount.toFixed(),
          dueDate: i.dueDate.toISOString().slice(0, 10),
        })),
      },
      lines: invoice.lines.map((line, index) => ({
        number: index + 1,
        quantity: line.quantity.toString(),
        unitCode: line.unitCode,
        // Free lines report their referential base in LineExtensionAmount.
        taxableAmount: (line.isFree
          ? line.referenceValue
          : line.taxableAmount
        ).toFixed(),
        // Net unit value with IGV, so Price × qty reconciles with LineExtensionAmount.
        unitPriceWithIgv: line.isFree
          ? line.referenceValue.toFixed()
          : line.taxableAmount
              .divideBy(line.quantity)
              .multiplyBy('1.18')
              .toFixed(),
        igvAmount: line.igv.toFixed(),
        igvPercent: line.affectation.isTaxed() ? IGV_PERCENT : '0.00',
        affectationCode: igvAffectationCode(line.affectation),
        tax: {
          id: line.affectation.taxScheme.id,
          name: line.affectation.taxScheme.name,
          internationalCode: line.affectation.taxScheme.internationalCode,
        },
        description: line.description,
        code: line.code,
        // Gross unit value for cac:Price (SUNAT rule 3271); discount is separate.
        unitValue: line.unitValue.toFixed(),
        priceTypeCode: line.isFree ? '02' : '01',
        isFree: line.isFree,
        discount: line.discount.toFixed(),
        discountBase: line.unitValue.multiplyBy(line.quantity).toFixed(),
      })),
    };
  }
}

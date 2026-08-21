import { Invoice } from '../../domain/aggregates/invoice';
import { InvalidPartyError } from '../../domain/errors/invoice-errors';
import type { AmountInWordsConverter } from '../../application/ports/amount-in-words-converter.port';
import { igvAffectationCode, IGV_PERCENT } from './ubl-catalog-mapper';

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
  readonly description: string;
  readonly code?: string;
  readonly unitValue: string;
}

/**
 * Immutable projection of the Invoice aggregate, built exclusively through
 * its public query methods. Everything the XML generator needs, nothing more.
 */
export interface UblInvoiceDocument {
  readonly id: string;
  /** SUNAT catalog 01: '01' factura, '03' boleta. */
  readonly documentType: string;
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
  readonly igv: string;
  readonly saleValue: string;
  readonly total: string;
  readonly payment: UblPayment;
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
      igv: invoice.igv.toFixed(),
      saleValue: invoice.saleValue.toFixed(),
      total: invoice.total.toFixed(),
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
        taxableAmount: line.taxableAmount.toFixed(),
        unitPriceWithIgv: line.unitPrice.toFixed(),
        igvAmount: line.igv.toFixed(),
        igvPercent: IGV_PERCENT,
        affectationCode: igvAffectationCode(line.affectation),
        description: line.description,
        code: line.code,
        unitValue: line.unitValue.toFixed(),
      })),
    };
  }
}

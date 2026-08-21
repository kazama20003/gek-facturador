import { randomUUID } from 'node:crypto';
import { Invoice } from '../../domain/aggregates/invoice';
import { DuplicateInvoiceError } from '../../domain/errors/invoice-errors';
import type { InvoiceRepository } from '../ports/invoice-repository.port';
import { Address } from '../../domain/value-objects/address';
import { Correlative } from '../../domain/value-objects/correlative';
import { Currency } from '../../domain/value-objects/currency';
import { InvoiceSeries } from '../../domain/value-objects/invoice-series';
import { Money } from '../../domain/value-objects/money';
import { IdentityDocument } from '../../domain/value-objects/identity-document';
import { Party } from '../../domain/value-objects/party';
import { Quantity } from '../../domain/value-objects/quantity';
import { Ruc } from '../../domain/value-objects/ruc';

export interface AddressInput {
  ubigeo: string;
  department: string;
  province: string;
  district: string;
  addressLine: string;
}

/** Primitive input — the boundary between presentation and the domain. */
export interface CreateInvoiceCommand {
  /** SUNAT catalog 01: '01' factura (default) | '03' boleta. */
  documentType?: '01' | '03';
  series: string;
  correlative: number;
  issueDate: string;
  currency: 'PEN' | 'USD';
  issuer: {
    ruc: string;
    businessName: string;
    tradeName?: string;
    address?: AddressInput;
  };
  /** Customer identity: RUC (invoices) or DNI (boletas). Exactly one. */
  customer: { ruc?: string; dni?: string; businessName: string };
  items: Array<{
    code?: string;
    description: string;
    unitCode: string;
    quantity: string;
    unitValue: string;
  }>;
}

/** Immutable, JSON-serializable application result. */
export interface CreateInvoiceResult {
  id: string;
  documentType: string;
  series: string;
  correlative: number;
  issueDate: string;
  currency: string;
  issuer: { ruc: string; businessName: string };
  customer: {
    documentType: string;
    documentNumber: string;
    businessName: string;
  };
  taxableAmount: string;
  igv: string;
  saleValue: string;
  total: string;
  items: Array<{
    code?: string;
    description: string;
    unitCode: string;
    quantity: string;
    unitValue: string;
    taxableAmount: string;
    igv: string;
    unitPrice: string;
    total: string;
  }>;
}

/** Serializes the aggregate for API responses. Shared by several use cases. */
export function serializeInvoice(invoice: Invoice): CreateInvoiceResult {
  return {
    id: invoice.id,
    documentType: invoice.documentType,
    series: invoice.series.toString(),
    correlative: invoice.correlative.toNumber(),
    issueDate: invoice.issueDate.toISOString(),
    currency: invoice.currency,
    issuer: {
      ruc: invoice.issuer.ruc.toString(),
      businessName: invoice.issuer.businessName,
    },
    customer: {
      documentType: invoice.customer.identity.code,
      documentNumber: invoice.customer.identity.toString(),
      businessName: invoice.customer.businessName,
    },
    taxableAmount: invoice.taxableAmount.toFixed(),
    igv: invoice.igv.toFixed(),
    saleValue: invoice.saleValue.toFixed(),
    total: invoice.total.toFixed(),
    items: invoice.lines.map((line) => ({
      code: line.code,
      description: line.description,
      unitCode: line.unitCode,
      quantity: line.quantity.toString(),
      unitValue: line.unitValue.toFixed(),
      taxableAmount: line.taxableAmount.toFixed(),
      igv: line.igv.toFixed(),
      unitPrice: line.unitPrice.toFixed(),
      total: line.total.toFixed(),
    })),
  };
}

/**
 * Creates, issues and persists a taxed invoice. Rejects duplicated
 * series+correlative for the same issuer.
 */
export class CreateInvoiceUseCase {
  constructor(private readonly invoices: InvoiceRepository) {}

  /** Builds and issues the aggregate. Reused by other use cases (e.g. XML generation). */
  buildAggregate(command: CreateInvoiceCommand): Invoice {
    const currency = Currency[command.currency];

    const invoice = Invoice.create({
      id: randomUUID(),
      documentType: command.documentType,
      series: InvoiceSeries.create(command.series),
      correlative: Correlative.create(command.correlative),
      issueDate: new Date(command.issueDate),
      currency,
      issuer: Party.create({
        ruc: Ruc.create(command.issuer.ruc),
        businessName: command.issuer.businessName,
        tradeName: command.issuer.tradeName,
        address: command.issuer.address
          ? Address.create(command.issuer.address)
          : undefined,
      }),
      customer: Party.withIdentity({
        identity: command.customer.dni
          ? IdentityDocument.dni(command.customer.dni)
          : IdentityDocument.ruc(command.customer.ruc ?? ''),
        businessName: command.customer.businessName,
      }),
    });

    for (const item of command.items) {
      invoice.addTaxableItem({
        code: item.code,
        description: item.description,
        unitCode: item.unitCode,
        quantity: Quantity.create(item.quantity),
        unitValue: Money.create(item.unitValue, currency),
      });
    }

    invoice.issue();
    return invoice;
  }

  async execute(command: CreateInvoiceCommand): Promise<CreateInvoiceResult> {
    const invoice = this.buildAggregate(command);

    const duplicated = await this.invoices.existsSeriesCorrelative(
      invoice.issuer.ruc.toString(),
      invoice.documentType,
      invoice.series.toString(),
      invoice.correlative.toNumber(),
    );
    if (duplicated) {
      throw new DuplicateInvoiceError(
        invoice.series.toString(),
        invoice.correlative.toNumber(),
      );
    }

    await this.invoices.save(invoice);
    return serializeInvoice(invoice);
  }
}

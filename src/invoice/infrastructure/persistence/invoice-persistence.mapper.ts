import type {
  Prisma,
  invoice as InvoiceRow,
  invoice_item as ItemRow,
} from '@prisma/client';
import {
  Invoice,
  type SaleDocumentType,
} from '../../domain/aggregates/invoice';
import { Address } from '../../domain/value-objects/address';
import { Correlative } from '../../domain/value-objects/correlative';
import { Currency } from '../../domain/value-objects/currency';
import { InvoiceSeries } from '../../domain/value-objects/invoice-series';
import { Money } from '../../domain/value-objects/money';
import { IdentityDocument } from '../../domain/value-objects/identity-document';
import { Party } from '../../domain/value-objects/party';
import { Quantity } from '../../domain/value-objects/quantity';
import { Ruc } from '../../domain/value-objects/ruc';

type RowWithItems = InvoiceRow & { items: ItemRow[] };

/** Translates between the aggregate and Prisma rows. Domain sees no Prisma types. */
export class InvoicePersistenceMapper {
  static toRow(invoice: Invoice): Prisma.invoiceCreateInput {
    const address = invoice.issuer.address;
    return {
      id: invoice.id,
      document_type: invoice.documentType,
      series: invoice.series.toString(),
      correlative: invoice.correlative.toNumber(),
      issue_date: invoice.issueDate,
      currency: invoice.currency,
      issuer_ruc: invoice.issuer.ruc.toString(),
      issuer_business_name: invoice.issuer.businessName,
      issuer_trade_name: invoice.issuer.tradeName ?? null,
      issuer_ubigeo: address?.ubigeo ?? null,
      issuer_department: address?.department ?? null,
      issuer_province: address?.province ?? null,
      issuer_district: address?.district ?? null,
      issuer_address_line: address?.addressLine ?? null,
      customer_ruc: invoice.customer.identity.toString(),
      customer_doc_type: invoice.customer.identity.code,
      customer_business_name: invoice.customer.businessName,
      taxable_amount: invoice.taxableAmount.toFixed(),
      igv: invoice.igv.toFixed(),
      sale_value: invoice.saleValue.toFixed(),
      total: invoice.total.toFixed(),
      status: 'ISSUED',
      items: {
        create: invoice.lines.map((line, index) => ({
          line_number: index + 1,
          code: line.code ?? null,
          description: line.description,
          unit_code: line.unitCode,
          quantity: line.quantity.toString(),
          unit_value: line.unitValue.toFixed(),
          taxable_amount: line.taxableAmount.toFixed(),
          igv: line.igv.toFixed(),
          unit_price: line.unitPrice.toFixed(),
          total: line.total.toFixed(),
        })),
      },
    };
  }

  /** Rebuilds the aggregate through its own factories, re-running invariants. */
  static toAggregate(row: RowWithItems): Invoice {
    const currency = row.currency as Currency;
    const invoice = Invoice.create({
      id: row.id,
      documentType: row.document_type as SaleDocumentType,
      series: InvoiceSeries.create(row.series),
      correlative: Correlative.create(row.correlative),
      issueDate: row.issue_date,
      currency,
      issuer: Party.create({
        ruc: Ruc.create(row.issuer_ruc),
        businessName: row.issuer_business_name,
        tradeName: row.issuer_trade_name ?? undefined,
        address:
          row.issuer_ubigeo &&
          row.issuer_department &&
          row.issuer_province &&
          row.issuer_district &&
          row.issuer_address_line
            ? Address.create({
                ubigeo: row.issuer_ubigeo,
                department: row.issuer_department,
                province: row.issuer_province,
                district: row.issuer_district,
                addressLine: row.issuer_address_line,
              })
            : undefined,
      }),
      customer: Party.withIdentity({
        identity:
          row.customer_doc_type === '1'
            ? IdentityDocument.dni(row.customer_ruc)
            : IdentityDocument.ruc(row.customer_ruc),
        businessName: row.customer_business_name,
      }),
    });

    for (const item of [...row.items].sort(
      (a, b) => a.line_number - b.line_number,
    )) {
      invoice.addTaxableItem({
        code: item.code ?? undefined,
        description: item.description,
        unitCode: item.unit_code,
        quantity: Quantity.create(item.quantity.toString()),
        unitValue: Money.create(item.unit_value.toString(), currency),
      });
    }

    invoice.issue();
    return invoice;
  }
}

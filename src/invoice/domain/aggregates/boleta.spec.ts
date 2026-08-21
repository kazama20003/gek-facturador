import { Invoice } from './invoice';
import {
  InvalidIdentityDocumentError,
  InvalidInvoiceSeriesError,
  InvalidPartyError,
} from '../errors/invoice-errors';
import { Correlative } from '../value-objects/correlative';
import { Currency } from '../value-objects/currency';
import { IdentityDocument } from '../value-objects/identity-document';
import { InvoiceSeries } from '../value-objects/invoice-series';
import { Party } from '../value-objects/party';
import { Ruc } from '../value-objects/ruc';

const issuer = () =>
  Party.create({ ruc: Ruc.create('20000000001'), businessName: 'EMITEC SAC' });

const dniCustomer = () =>
  Party.withIdentity({
    identity: IdentityDocument.dni('12345678'),
    businessName: 'JUAN PEREZ',
  });

function build(params: {
  documentType?: '01' | '03';
  series: string;
  customer: Party;
}): Invoice {
  return Invoice.create({
    id: 'doc-1',
    documentType: params.documentType,
    series: InvoiceSeries.create(params.series),
    correlative: Correlative.create(1),
    issueDate: new Date('2026-08-20'),
    currency: Currency.PEN,
    issuer: issuer(),
    customer: params.customer,
  });
}

describe('Boleta (document type 03)', () => {
  it('accepts a B-series boleta with a DNI customer', () => {
    const boleta = build({
      documentType: '03',
      series: 'B001',
      customer: dniCustomer(),
    });
    expect(boleta.documentType).toBe('03');
    expect(boleta.customer.identity.code).toBe('1');
    expect(boleta.customer.identity.toString()).toBe('12345678');
  });

  it('rejects a boleta with an F series and an invoice with a B series', () => {
    expect(() =>
      build({ documentType: '03', series: 'F001', customer: dniCustomer() }),
    ).toThrow(InvalidInvoiceSeriesError);
    expect(() =>
      build({
        documentType: '01',
        series: 'B001',
        customer: Party.create({
          ruc: Ruc.create('20100070970'),
          businessName: 'CLIENTE SAC',
        }),
      }),
    ).toThrow(InvalidInvoiceSeriesError);
  });

  it('rejects an invoice (01) with a DNI customer', () => {
    expect(() =>
      build({ documentType: '01', series: 'F001', customer: dniCustomer() }),
    ).toThrow(InvalidPartyError);
  });

  it('validates DNI format', () => {
    expect(() => IdentityDocument.dni('1234')).toThrow(
      InvalidIdentityDocumentError,
    );
    expect(() => IdentityDocument.dni('1234567A')).toThrow(
      InvalidIdentityDocumentError,
    );
  });

  it('accessing .ruc on a DNI party fails explicitly', () => {
    expect(() => dniCustomer().ruc).toThrow(InvalidPartyError);
  });
});

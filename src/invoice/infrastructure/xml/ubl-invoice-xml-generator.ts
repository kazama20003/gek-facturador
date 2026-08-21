import { create } from 'xmlbuilder2';
import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { Invoice } from '../../domain/aggregates/invoice';
import type { InvoiceXmlGenerator } from '../../application/ports/invoice-xml-generator.port';
import { UBL_NAMESPACES as NS } from './ubl-namespaces';
import {
  CUSTOMIZATION_ID,
  SIGNATURE_ID,
  SUNAT_CATALOGS as CAT,
  UBL_VERSION,
} from './ubl-catalog-mapper';
import { UblInvoiceDocument, UblInvoiceMapper } from './ubl-invoice-mapper';

/**
 * Renders an issued Invoice as SUNAT-flavored UBL 2.1 XML.
 * Deterministic: same aggregate → same XML (stable node order, no random ids,
 * date/time taken from the aggregate). Escaping is handled by xmlbuilder2.
 */
export class UblInvoiceXmlGenerator implements InvoiceXmlGenerator {
  constructor(private readonly mapper: UblInvoiceMapper) {}

  generate(invoice: Invoice): string {
    const doc = this.mapper.map(invoice);

    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele(
      NS.invoice,
      'Invoice',
    );
    for (const [prefix, uri] of Object.entries(NS)) {
      if (prefix !== 'invoice') root.att(`xmlns:${prefix}`, uri);
    }

    this.buildExtensions(root);
    this.buildHeader(root, doc);
    this.buildSignature(root, doc);
    this.buildSupplier(root, doc);
    this.buildCustomer(root, doc);
    this.buildPaymentTerms(root);
    this.buildTaxTotal(root, doc);
    this.buildMonetaryTotal(root, doc);
    for (const line of doc.lines) this.buildLine(root, doc, line);

    return root.end({ prettyPrint: true });
  }

  /** Empty ExtensionContent — the ds:Signature will be inserted here in the next stage. */
  private buildExtensions(root: XMLBuilder): void {
    root
      .ele(NS.ext, 'UBLExtensions')
      .ele(NS.ext, 'UBLExtension')
      .ele(NS.ext, 'ExtensionContent');
  }

  private buildHeader(root: XMLBuilder, doc: UblInvoiceDocument): void {
    root.ele(NS.cbc, 'UBLVersionID').txt(UBL_VERSION);
    root.ele(NS.cbc, 'CustomizationID').txt(CUSTOMIZATION_ID);
    root.ele(NS.cbc, 'ID').txt(doc.id);
    root.ele(NS.cbc, 'IssueDate').txt(doc.issueDate);
    root.ele(NS.cbc, 'IssueTime').txt(doc.issueTime);
    root
      .ele(NS.cbc, 'InvoiceTypeCode')
      .att('listAgencyName', CAT.documentType.listAgencyName)
      .att('listName', CAT.documentType.listName)
      .att('listURI', CAT.documentType.listURI)
      .att('listID', CAT.operationType.internalSale)
      .att('listSchemeURI', CAT.operationType.listSchemeURI)
      .txt(doc.documentType);
    root
      .ele(NS.cbc, 'Note')
      .att('languageLocaleID', CAT.legend.amountInWords)
      .txt(doc.amountInWords);
    root
      .ele(NS.cbc, 'DocumentCurrencyCode')
      .att('listID', CAT.currency.listID)
      .att('listName', CAT.currency.listName)
      .att('listAgencyName', CAT.currency.listAgencyName)
      .txt(doc.currency);
  }

  /** Declarative signature reference required by SUNAT (matches SIGNATURE_ID). */
  private buildSignature(root: XMLBuilder, doc: UblInvoiceDocument): void {
    const signature = root.ele(NS.cac, 'Signature');
    signature.ele(NS.cbc, 'ID').txt(SIGNATURE_ID);
    const party = signature.ele(NS.cac, 'SignatoryParty');
    party
      .ele(NS.cac, 'PartyIdentification')
      .ele(NS.cbc, 'ID')
      .txt(doc.issuer.ruc);
    party
      .ele(NS.cac, 'PartyName')
      .ele(NS.cbc, 'Name')
      .txt(doc.issuer.businessName);
    signature
      .ele(NS.cac, 'DigitalSignatureAttachment')
      .ele(NS.cac, 'ExternalReference')
      .ele(NS.cbc, 'URI')
      .txt(`#${SIGNATURE_ID}`);
  }

  private buildSupplier(root: XMLBuilder, doc: UblInvoiceDocument): void {
    const party = root
      .ele(NS.cac, 'AccountingSupplierParty')
      .ele(NS.cac, 'Party');
    this.buildPartyIdentification(
      party,
      doc.issuer.ruc,
      CAT.identityDocumentType.ruc,
    );
    if (doc.issuer.tradeName) {
      party
        .ele(NS.cac, 'PartyName')
        .ele(NS.cbc, 'Name')
        .txt(doc.issuer.tradeName);
    }
    const legal = party.ele(NS.cac, 'PartyLegalEntity');
    legal.ele(NS.cbc, 'RegistrationName').txt(doc.issuer.businessName);
    const address = legal.ele(NS.cac, 'RegistrationAddress');
    address
      .ele(NS.cbc, 'ID')
      .att('schemeAgencyName', CAT.ubigeo.schemeAgencyName)
      .att('schemeName', CAT.ubigeo.schemeName)
      .txt(doc.issuer.address.ubigeo);
    address
      .ele(NS.cbc, 'AddressTypeCode')
      .att('listAgencyName', CAT.establishment.listAgencyName)
      .att('listName', CAT.establishment.listName)
      .txt(CAT.establishment.main);
    address.ele(NS.cbc, 'CityName').txt(doc.issuer.address.province);
    address.ele(NS.cbc, 'CountrySubentity').txt(doc.issuer.address.department);
    address.ele(NS.cbc, 'District').txt(doc.issuer.address.district);
    address
      .ele(NS.cac, 'AddressLine')
      .ele(NS.cbc, 'Line')
      .txt(doc.issuer.address.addressLine);
    address.ele(NS.cac, 'Country').ele(NS.cbc, 'IdentificationCode').txt('PE');
  }

  private buildCustomer(root: XMLBuilder, doc: UblInvoiceDocument): void {
    const party = root
      .ele(NS.cac, 'AccountingCustomerParty')
      .ele(NS.cac, 'Party');
    this.buildPartyIdentification(
      party,
      doc.customer.docNumber,
      doc.customer.docCode,
    );
    party
      .ele(NS.cac, 'PartyLegalEntity')
      .ele(NS.cbc, 'RegistrationName')
      .txt(doc.customer.businessName);
  }

  private buildPartyIdentification(
    party: XMLBuilder,
    docNumber: string,
    docCode: string,
  ): void {
    party
      .ele(NS.cac, 'PartyIdentification')
      .ele(NS.cbc, 'ID')
      .att('schemeID', docCode)
      .att('schemeName', CAT.identityDocumentType.schemeName)
      .att('schemeAgencyName', CAT.identityDocumentType.schemeAgencyName)
      .att('schemeURI', CAT.identityDocumentType.schemeURI)
      .txt(docNumber);
  }

  private buildTaxScheme(parent: XMLBuilder): void {
    const scheme = parent.ele(NS.cac, 'TaxScheme');
    scheme
      .ele(NS.cbc, 'ID')
      .att('schemeName', CAT.tax.schemeName)
      .att('schemeAgencyName', CAT.tax.schemeAgencyName)
      .att('schemeURI', CAT.tax.schemeURI)
      .txt(CAT.tax.igv.id);
    scheme.ele(NS.cbc, 'Name').txt(CAT.tax.igv.name);
    scheme.ele(NS.cbc, 'TaxTypeCode').txt(CAT.tax.igv.typeCode);
  }

  /** Forma de pago (mandatory since R.S. 193-2020; SUNAT error 3244 if absent). */
  private buildPaymentTerms(root: XMLBuilder): void {
    const terms = root.ele(NS.cac, 'PaymentTerms');
    terms.ele(NS.cbc, 'ID').txt(CAT.paymentTerms.id);
    terms.ele(NS.cbc, 'PaymentMeansID').txt(CAT.paymentTerms.cash);
  }

  private buildTaxTotal(root: XMLBuilder, doc: UblInvoiceDocument): void {
    const taxTotal = root.ele(NS.cac, 'TaxTotal');
    taxTotal
      .ele(NS.cbc, 'TaxAmount')
      .att('currencyID', doc.currency)
      .txt(doc.igv);
    const subtotal = taxTotal.ele(NS.cac, 'TaxSubtotal');
    subtotal
      .ele(NS.cbc, 'TaxableAmount')
      .att('currencyID', doc.currency)
      .txt(doc.taxableAmount);
    subtotal
      .ele(NS.cbc, 'TaxAmount')
      .att('currencyID', doc.currency)
      .txt(doc.igv);
    this.buildTaxScheme(subtotal.ele(NS.cac, 'TaxCategory'));
  }

  private buildMonetaryTotal(root: XMLBuilder, doc: UblInvoiceDocument): void {
    const total = root.ele(NS.cac, 'LegalMonetaryTotal');
    total
      .ele(NS.cbc, 'LineExtensionAmount')
      .att('currencyID', doc.currency)
      .txt(doc.saleValue);
    total
      .ele(NS.cbc, 'TaxInclusiveAmount')
      .att('currencyID', doc.currency)
      .txt(doc.total);
    total
      .ele(NS.cbc, 'PayableAmount')
      .att('currencyID', doc.currency)
      .txt(doc.total);
  }

  private buildLine(
    root: XMLBuilder,
    doc: UblInvoiceDocument,
    line: UblInvoiceDocument['lines'][number],
  ): void {
    const invoiceLine = root.ele(NS.cac, 'InvoiceLine');
    invoiceLine.ele(NS.cbc, 'ID').txt(String(line.number));
    invoiceLine
      .ele(NS.cbc, 'InvoicedQuantity')
      .att('unitCode', line.unitCode)
      .att('unitCodeListID', CAT.unit.unitCodeListID)
      .att('unitCodeListAgencyName', CAT.unit.unitCodeListAgencyName)
      .txt(line.quantity);
    invoiceLine
      .ele(NS.cbc, 'LineExtensionAmount')
      .att('currencyID', doc.currency)
      .txt(line.taxableAmount);

    const pricing = invoiceLine
      .ele(NS.cac, 'PricingReference')
      .ele(NS.cac, 'AlternativeConditionPrice');
    pricing
      .ele(NS.cbc, 'PriceAmount')
      .att('currencyID', doc.currency)
      .txt(line.unitPriceWithIgv);
    pricing
      .ele(NS.cbc, 'PriceTypeCode')
      .att('listName', CAT.priceType.listName)
      .att('listAgencyName', CAT.priceType.listAgencyName)
      .att('listURI', CAT.priceType.listURI)
      .txt(CAT.priceType.unitPriceIncludingIgv);

    const taxTotal = invoiceLine.ele(NS.cac, 'TaxTotal');
    taxTotal
      .ele(NS.cbc, 'TaxAmount')
      .att('currencyID', doc.currency)
      .txt(line.igvAmount);
    const subtotal = taxTotal.ele(NS.cac, 'TaxSubtotal');
    subtotal
      .ele(NS.cbc, 'TaxableAmount')
      .att('currencyID', doc.currency)
      .txt(line.taxableAmount);
    subtotal
      .ele(NS.cbc, 'TaxAmount')
      .att('currencyID', doc.currency)
      .txt(line.igvAmount);
    const category = subtotal.ele(NS.cac, 'TaxCategory');
    category.ele(NS.cbc, 'Percent').txt(line.igvPercent);
    category
      .ele(NS.cbc, 'TaxExemptionReasonCode')
      .att('listAgencyName', CAT.igvAffectation.listAgencyName)
      .att('listName', CAT.igvAffectation.listName)
      .att('listURI', CAT.igvAffectation.listURI)
      .txt(line.affectationCode);
    this.buildTaxScheme(category);

    const item = invoiceLine.ele(NS.cac, 'Item');
    item.ele(NS.cbc, 'Description').txt(line.description);
    if (line.code) {
      item
        .ele(NS.cac, 'SellersItemIdentification')
        .ele(NS.cbc, 'ID')
        .txt(line.code);
    }
    invoiceLine
      .ele(NS.cac, 'Price')
      .ele(NS.cbc, 'PriceAmount')
      .att('currencyID', doc.currency)
      .txt(line.unitValue);
  }
}

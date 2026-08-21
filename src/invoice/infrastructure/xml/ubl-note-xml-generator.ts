import { create } from 'xmlbuilder2';
import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { Note } from '../../domain/aggregates/note';
import { NoteType } from '../../domain/value-objects/note-type.enum';
import { UBL_NAMESPACES as NS } from './ubl-namespaces';
import {
  CUSTOMIZATION_ID,
  SIGNATURE_ID,
  SUNAT_CATALOGS as CAT,
  UBL_VERSION,
} from './ubl-catalog-mapper';
import { UblNoteDocument, UblNoteMapper } from './ubl-note-mapper';

const CREDIT_NOTE_NS =
  'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2';
const DEBIT_NOTE_NS =
  'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2';

/**
 * Renders a credit/debit Note as SUNAT-flavored UBL 2.1 XML. Deterministic,
 * same conventions as the invoice generator. Structural differences per UBL:
 * root element, DiscrepancyResponse + BillingReference, Credited/DebitedQuantity
 * lines and RequestedMonetaryTotal (debit notes only).
 */
export class UblNoteXmlGenerator {
  constructor(private readonly mapper: UblNoteMapper) {}

  generate(note: Note): string {
    const doc = this.mapper.map(note);
    const isCredit = doc.type === NoteType.Credit;
    const rootName = isCredit ? 'CreditNote' : 'DebitNote';
    const rootNs = isCredit ? CREDIT_NOTE_NS : DEBIT_NOTE_NS;

    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele(
      rootNs,
      rootName,
    );
    for (const [prefix, uri] of Object.entries(NS)) {
      if (prefix !== 'invoice') root.att(`xmlns:${prefix}`, uri);
    }

    root
      .ele(NS.ext, 'UBLExtensions')
      .ele(NS.ext, 'UBLExtension')
      .ele(NS.ext, 'ExtensionContent');
    root.ele(NS.cbc, 'UBLVersionID').txt(UBL_VERSION);
    root.ele(NS.cbc, 'CustomizationID').txt(CUSTOMIZATION_ID);
    root.ele(NS.cbc, 'ID').txt(doc.id);
    root.ele(NS.cbc, 'IssueDate').txt(doc.issueDate);
    root.ele(NS.cbc, 'IssueTime').txt(doc.issueTime);
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

    const discrepancy = root.ele(NS.cac, 'DiscrepancyResponse');
    discrepancy.ele(NS.cbc, 'ReferenceID').txt(doc.modifies.id);
    discrepancy.ele(NS.cbc, 'ResponseCode').txt(doc.reason.code);
    discrepancy.ele(NS.cbc, 'Description').txt(doc.reason.description);

    const billingRef = root
      .ele(NS.cac, 'BillingReference')
      .ele(NS.cac, 'InvoiceDocumentReference');
    billingRef.ele(NS.cbc, 'ID').txt(doc.modifies.id);
    billingRef.ele(NS.cbc, 'DocumentTypeCode').txt(doc.modifies.documentType);

    this.buildSignature(root, doc);
    this.buildSupplier(root, doc);
    this.buildCustomer(root, doc);
    this.buildTaxTotal(root, doc);

    const totalName = isCredit
      ? 'LegalMonetaryTotal'
      : 'RequestedMonetaryTotal';
    const total = root.ele(NS.cac, totalName);
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

    for (const line of doc.lines) this.buildLine(root, doc, line, isCredit);

    return root.end({ prettyPrint: true });
  }

  private buildSignature(root: XMLBuilder, doc: UblNoteDocument): void {
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

  private buildPartyIdentification(party: XMLBuilder, ruc: string): void {
    party
      .ele(NS.cac, 'PartyIdentification')
      .ele(NS.cbc, 'ID')
      .att('schemeID', CAT.identityDocumentType.ruc)
      .att('schemeName', CAT.identityDocumentType.schemeName)
      .att('schemeAgencyName', CAT.identityDocumentType.schemeAgencyName)
      .att('schemeURI', CAT.identityDocumentType.schemeURI)
      .txt(ruc);
  }

  private buildSupplier(root: XMLBuilder, doc: UblNoteDocument): void {
    const party = root
      .ele(NS.cac, 'AccountingSupplierParty')
      .ele(NS.cac, 'Party');
    this.buildPartyIdentification(party, doc.issuer.ruc);
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

  private buildCustomer(root: XMLBuilder, doc: UblNoteDocument): void {
    const party = root
      .ele(NS.cac, 'AccountingCustomerParty')
      .ele(NS.cac, 'Party');
    this.buildPartyIdentification(party, doc.customer.ruc);
    party
      .ele(NS.cac, 'PartyLegalEntity')
      .ele(NS.cbc, 'RegistrationName')
      .txt(doc.customer.businessName);
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

  private buildTaxTotal(root: XMLBuilder, doc: UblNoteDocument): void {
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

  private buildLine(
    root: XMLBuilder,
    doc: UblNoteDocument,
    line: UblNoteDocument['lines'][number],
    isCredit: boolean,
  ): void {
    const noteLine = root.ele(
      NS.cac,
      isCredit ? 'CreditNoteLine' : 'DebitNoteLine',
    );
    noteLine.ele(NS.cbc, 'ID').txt(String(line.number));
    noteLine
      .ele(NS.cbc, isCredit ? 'CreditedQuantity' : 'DebitedQuantity')
      .att('unitCode', line.unitCode)
      .att('unitCodeListID', CAT.unit.unitCodeListID)
      .att('unitCodeListAgencyName', CAT.unit.unitCodeListAgencyName)
      .txt(line.quantity);
    noteLine
      .ele(NS.cbc, 'LineExtensionAmount')
      .att('currencyID', doc.currency)
      .txt(line.taxableAmount);

    const pricing = noteLine
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

    const taxTotal = noteLine.ele(NS.cac, 'TaxTotal');
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

    const item = noteLine.ele(NS.cac, 'Item');
    item.ele(NS.cbc, 'Description').txt(line.description);
    if (line.code) {
      item
        .ele(NS.cac, 'SellersItemIdentification')
        .ele(NS.cbc, 'ID')
        .txt(line.code);
    }
    noteLine
      .ele(NS.cac, 'Price')
      .ele(NS.cbc, 'PriceAmount')
      .att('currencyID', doc.currency)
      .txt(line.unitValue);
  }
}

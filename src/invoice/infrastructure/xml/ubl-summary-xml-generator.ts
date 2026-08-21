import { create } from 'xmlbuilder2';
import { Invoice } from '../../domain/aggregates/invoice';
import { UBL_NAMESPACES as NS } from './ubl-namespaces';
import { SIGNATURE_ID, SUNAT_CATALOGS as CAT } from './ubl-catalog-mapper';

const SUMMARY_NS =
  'urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1';

export interface SummaryLine {
  boleta: Invoice;
  /** Catalog: 1 = add, 2 = modify, 3 = void. */
  conditionCode: '1' | '3';
}

export interface DailySummaryInput {
  /** Issue date of the summarized boletas (YYYY-MM-DD). */
  referenceDate: string;
  /** Date the summary itself is generated (YYYY-MM-DD). */
  issueDate: string;
  /** Sequential number of summaries sent for referenceDate. */
  correlative: number;
  lines: ReadonlyArray<SummaryLine>;
}

export function summaryId(referenceDate: string, correlative: number): string {
  return `RC-${referenceDate.replaceAll('-', '')}-${correlative}`;
}

/**
 * Renders the daily boleta summary (Resumen Diario, RC) as SUNAT
 * SummaryDocuments XML. Per SUNAT spec this document uses UBL 2.0 with
 * CustomizationID 1.1 — unlike invoices/notes, which use UBL 2.1.
 * Amounts come straight from the domain aggregates.
 */
export class UblSummaryXmlGenerator {
  generate(input: DailySummaryInput): string {
    const issuer = input.lines[0].boleta.issuer;
    const id = summaryId(input.referenceDate, input.correlative);

    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele(
      SUMMARY_NS,
      'SummaryDocuments',
    );
    for (const [prefix, uri] of Object.entries(NS)) {
      if (prefix !== 'invoice') root.att(`xmlns:${prefix}`, uri);
    }

    root
      .ele(NS.ext, 'UBLExtensions')
      .ele(NS.ext, 'UBLExtension')
      .ele(NS.ext, 'ExtensionContent');
    root.ele(NS.cbc, 'UBLVersionID').txt('2.0');
    root.ele(NS.cbc, 'CustomizationID').txt('1.1');
    root.ele(NS.cbc, 'ID').txt(id);
    root.ele(NS.cbc, 'ReferenceDate').txt(input.referenceDate);
    root.ele(NS.cbc, 'IssueDate').txt(input.issueDate);

    const signature = root.ele(NS.cac, 'Signature');
    signature.ele(NS.cbc, 'ID').txt(SIGNATURE_ID);
    const signatory = signature.ele(NS.cac, 'SignatoryParty');
    signatory
      .ele(NS.cac, 'PartyIdentification')
      .ele(NS.cbc, 'ID')
      .txt(issuer.ruc.toString());
    signatory
      .ele(NS.cac, 'PartyName')
      .ele(NS.cbc, 'Name')
      .txt(issuer.businessName);
    signature
      .ele(NS.cac, 'DigitalSignatureAttachment')
      .ele(NS.cac, 'ExternalReference')
      .ele(NS.cbc, 'URI')
      .txt(`#${SIGNATURE_ID}`);

    // UBL 2.0-style supplier block required by the SummaryDocuments schema.
    const supplier = root.ele(NS.cac, 'AccountingSupplierParty');
    supplier
      .ele(NS.cbc, 'CustomerAssignedAccountID')
      .txt(issuer.ruc.toString());
    supplier
      .ele(NS.cbc, 'AdditionalAccountID')
      .txt(CAT.identityDocumentType.ruc);
    supplier
      .ele(NS.cac, 'Party')
      .ele(NS.cac, 'PartyLegalEntity')
      .ele(NS.cbc, 'RegistrationName')
      .txt(issuer.businessName);

    input.lines.forEach((line, index) =>
      this.buildLine(root, line.boleta, index + 1, line.conditionCode),
    );

    return root.end({ prettyPrint: true });
  }

  private buildLine(
    root: ReturnType<typeof create>,
    boleta: Invoice,
    lineNumber: number,
    conditionCode: '1' | '3',
  ): void {
    const currency = boleta.currency;
    const line = root.ele(NS.sac, 'SummaryDocumentsLine');
    line.ele(NS.cbc, 'LineID').txt(String(lineNumber));
    line.ele(NS.cbc, 'DocumentTypeCode').txt(boleta.documentType);
    line
      .ele(NS.cbc, 'ID')
      .txt(`${boleta.series.toString()}-${boleta.correlative.toNumber()}`);

    const customer = line.ele(NS.cac, 'AccountingCustomerParty');
    customer
      .ele(NS.cbc, 'CustomerAssignedAccountID')
      .txt(boleta.customer.identity.toString());
    customer
      .ele(NS.cbc, 'AdditionalAccountID')
      .txt(boleta.customer.identity.code);

    // Catalog: 1 adicionar, 2 modificar, 3 anular.
    line.ele(NS.cac, 'Status').ele(NS.cbc, 'ConditionCode').txt(conditionCode);

    line
      .ele(NS.sac, 'TotalAmount')
      .att('currencyID', currency)
      .txt(boleta.total.toFixed());

    const payment = line.ele(NS.sac, 'BillingPayment');
    payment
      .ele(NS.cbc, 'PaidAmount')
      .att('currencyID', currency)
      .txt(boleta.taxableAmount.toFixed());
    // InstructionID 01 = gravado (catalog 11).
    payment.ele(NS.cbc, 'InstructionID').txt('01');

    const taxTotal = line.ele(NS.cac, 'TaxTotal');
    taxTotal
      .ele(NS.cbc, 'TaxAmount')
      .att('currencyID', currency)
      .txt(boleta.igv.toFixed());
    const subtotal = taxTotal.ele(NS.cac, 'TaxSubtotal');
    subtotal
      .ele(NS.cbc, 'TaxAmount')
      .att('currencyID', currency)
      .txt(boleta.igv.toFixed());
    const scheme = subtotal.ele(NS.cac, 'TaxCategory').ele(NS.cac, 'TaxScheme');
    scheme.ele(NS.cbc, 'ID').txt(CAT.tax.igv.id);
    scheme.ele(NS.cbc, 'Name').txt(CAT.tax.igv.name);
    scheme.ele(NS.cbc, 'TaxTypeCode').txt(CAT.tax.igv.typeCode);
  }
}

import { create } from 'xmlbuilder2';
import { UBL_NAMESPACES as NS } from './ubl-namespaces';
import { SIGNATURE_ID, SUNAT_CATALOGS as CAT } from './ubl-catalog-mapper';

const VOIDED_NS =
  'urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1';

export interface VoidedLine {
  /** SUNAT catalog 01 type of the voided document: 01, 07 or 08. */
  documentType: string;
  series: string;
  correlative: number;
  reason: string;
}

export interface VoidedDocumentsInput {
  issuer: { ruc: string; businessName: string };
  /** Issue date of the documents being voided (YYYY-MM-DD). */
  referenceDate: string;
  /** Date the communication is generated (YYYY-MM-DD). */
  issueDate: string;
  /** Sequential number of communications sent for referenceDate. */
  correlative: number;
  lines: ReadonlyArray<VoidedLine>;
}

export function voidedId(referenceDate: string, correlative: number): string {
  return `RA-${referenceDate.replaceAll('-', '')}-${correlative}`;
}

/**
 * Renders the voided-documents communication (Comunicación de Baja, RA) as
 * SUNAT VoidedDocuments XML (UBL 2.0, CustomizationID 1.0). Applies to
 * invoices and notes; boletas are voided through the daily summary instead
 * (ConditionCode 3).
 */
export class UblVoidedXmlGenerator {
  generate(input: VoidedDocumentsInput): string {
    const id = voidedId(input.referenceDate, input.correlative);

    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele(
      VOIDED_NS,
      'VoidedDocuments',
    );
    for (const [prefix, uri] of Object.entries(NS)) {
      if (prefix !== 'invoice') root.att(`xmlns:${prefix}`, uri);
    }

    root
      .ele(NS.ext, 'UBLExtensions')
      .ele(NS.ext, 'UBLExtension')
      .ele(NS.ext, 'ExtensionContent');
    root.ele(NS.cbc, 'UBLVersionID').txt('2.0');
    root.ele(NS.cbc, 'CustomizationID').txt('1.0');
    root.ele(NS.cbc, 'ID').txt(id);
    root.ele(NS.cbc, 'ReferenceDate').txt(input.referenceDate);
    root.ele(NS.cbc, 'IssueDate').txt(input.issueDate);

    const signature = root.ele(NS.cac, 'Signature');
    signature.ele(NS.cbc, 'ID').txt(SIGNATURE_ID);
    const signatory = signature.ele(NS.cac, 'SignatoryParty');
    signatory
      .ele(NS.cac, 'PartyIdentification')
      .ele(NS.cbc, 'ID')
      .txt(input.issuer.ruc);
    signatory
      .ele(NS.cac, 'PartyName')
      .ele(NS.cbc, 'Name')
      .txt(input.issuer.businessName);
    signature
      .ele(NS.cac, 'DigitalSignatureAttachment')
      .ele(NS.cac, 'ExternalReference')
      .ele(NS.cbc, 'URI')
      .txt(`#${SIGNATURE_ID}`);

    const supplier = root.ele(NS.cac, 'AccountingSupplierParty');
    supplier.ele(NS.cbc, 'CustomerAssignedAccountID').txt(input.issuer.ruc);
    supplier
      .ele(NS.cbc, 'AdditionalAccountID')
      .txt(CAT.identityDocumentType.ruc);
    supplier
      .ele(NS.cac, 'Party')
      .ele(NS.cac, 'PartyLegalEntity')
      .ele(NS.cbc, 'RegistrationName')
      .txt(input.issuer.businessName);

    input.lines.forEach((line, index) => {
      const voided = root.ele(NS.sac, 'VoidedDocumentsLine');
      voided.ele(NS.cbc, 'LineID').txt(String(index + 1));
      voided.ele(NS.cbc, 'DocumentTypeCode').txt(line.documentType);
      voided.ele(NS.sac, 'DocumentSerialID').txt(line.series);
      voided.ele(NS.sac, 'DocumentNumberID').txt(String(line.correlative));
      voided.ele(NS.sac, 'VoidReasonDescription').txt(line.reason);
    });

    return root.end({ prettyPrint: true });
  }
}

import { Note } from '../../domain/aggregates/note';
import type { InvoicePackager } from '../ports/invoice-packager.port';
import type { InvoiceXmlSigner } from '../ports/invoice-xml-signer.port';
import type {
  CdrResult,
  SunatBillSender,
} from '../ports/sunat-bill-sender.port';

/** Port shape for the note XML generator (implemented by UblNoteXmlGenerator). */
export interface NoteXmlGenerator {
  generate(note: Note): string;
}

export const NOTE_XML_GENERATOR = Symbol('NoteXmlGenerator');

export interface SendNoteToSunatResult {
  readonly fileName: string;
  readonly cdr: CdrResult;
  readonly cdrZipBase64: string;
  readonly signedXml: string;
}

/** Note pipeline: generate UBL XML → sign → ZIP (RUC-07/08-SERIE-CORR) → sendBill → CDR. */
export class SendNoteToSunatUseCase {
  constructor(
    private readonly generator: NoteXmlGenerator,
    private readonly signer: InvoiceXmlSigner,
    private readonly packager: InvoicePackager,
    private readonly sender: SunatBillSender,
  ) {}

  async execute(note: Note): Promise<SendNoteToSunatResult> {
    note.issue();

    const baseFileName = [
      note.issuer.ruc.toString(),
      note.documentType,
      note.series.toString(),
      note.correlative.toNumber(),
    ].join('-');

    const signedXml = this.signer.sign(this.generator.generate(note));
    const zip = await this.packager.package(baseFileName, signedXml);
    const { cdr, cdrZipBase64 } = await this.sender.send(
      `${baseFileName}.zip`,
      zip,
    );

    return { fileName: `${baseFileName}.zip`, cdr, cdrZipBase64, signedXml };
  }
}

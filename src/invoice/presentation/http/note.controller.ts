import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { NoteType } from '../../domain/value-objects/note-type.enum';
import { CreateNoteUseCase } from '../../application/use-cases/create-note.use-case';
import {
  SendNoteToSunatUseCase,
  type SendNoteToSunatResult,
} from '../../application/use-cases/send-note-to-sunat.use-case';
import {
  INVOICE_XML_SIGNER,
  type InvoiceXmlSigner,
} from '../../application/ports/invoice-xml-signer.port';
import {
  NOTE_XML_GENERATOR,
  type NoteXmlGenerator,
} from '../../application/use-cases/send-note-to-sunat.use-case';
import { CreateNoteDto } from './dto/create-note.dto';

/** HTTP adapter for credit/debit notes. Development endpoints — not a public API. */
@Controller()
export class NoteController {
  constructor(
    @Inject(CreateNoteUseCase)
    private readonly createNote: CreateNoteUseCase,
    @Inject(SendNoteToSunatUseCase)
    private readonly sendNoteToSunat: SendNoteToSunatUseCase,
    @Inject(NOTE_XML_GENERATOR)
    private readonly noteXmlGenerator: NoteXmlGenerator,
    @Inject(INVOICE_XML_SIGNER)
    private readonly signer: InvoiceXmlSigner,
  ) {}

  @Post('credit-notes/xml/signed')
  @HttpCode(HttpStatus.CREATED)
  @Header('Content-Type', 'application/xml')
  creditNoteXml(@Body() dto: CreateNoteDto): string {
    return this.signedXml(NoteType.Credit, dto);
  }

  @Post('debit-notes/xml/signed')
  @HttpCode(HttpStatus.CREATED)
  @Header('Content-Type', 'application/xml')
  debitNoteXml(@Body() dto: CreateNoteDto): string {
    return this.signedXml(NoteType.Debit, dto);
  }

  @Post('credit-notes/sunat/send')
  @HttpCode(HttpStatus.CREATED)
  sendCreditNote(@Body() dto: CreateNoteDto): Promise<SendNoteToSunatResult> {
    return this.sendNoteToSunat.execute(
      this.createNote.buildAggregate(NoteType.Credit, dto),
    );
  }

  @Post('debit-notes/sunat/send')
  @HttpCode(HttpStatus.CREATED)
  sendDebitNote(@Body() dto: CreateNoteDto): Promise<SendNoteToSunatResult> {
    return this.sendNoteToSunat.execute(
      this.createNote.buildAggregate(NoteType.Debit, dto),
    );
  }

  private signedXml(type: NoteType, dto: CreateNoteDto): string {
    const note = this.createNote.buildAggregate(type, dto);
    return this.signer.sign(this.noteXmlGenerator.generate(note));
  }
}

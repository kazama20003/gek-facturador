import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { NoteType } from '../../domain/value-objects/note-type.enum';
import {
  CreateNoteUseCase,
  type CreateNoteResult,
} from '../../application/use-cases/create-note.use-case';
import {
  FindNoteUseCase,
  type FindNoteResult,
} from '../../application/use-cases/find-note.use-case';
import { SubmitStoredNoteUseCase } from '../../application/use-cases/submit-stored-note.use-case';
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
    @Inject(FindNoteUseCase)
    private readonly findNote: FindNoteUseCase,
    @Inject(SubmitStoredNoteUseCase)
    private readonly submitStoredNote: SubmitStoredNoteUseCase,
  ) {}

  @Post('credit-notes')
  @HttpCode(HttpStatus.CREATED)
  createCreditNote(@Body() dto: CreateNoteDto): Promise<CreateNoteResult> {
    return this.createNote.execute(NoteType.Credit, dto);
  }

  @Post('debit-notes')
  @HttpCode(HttpStatus.CREATED)
  createDebitNote(@Body() dto: CreateNoteDto): Promise<CreateNoteResult> {
    return this.createNote.execute(NoteType.Debit, dto);
  }

  @Get('notes/:id')
  find(@Param('id') id: string): Promise<FindNoteResult> {
    return this.findNote.execute(id);
  }

  /** Submits a persisted note to SUNAT and records the CDR outcome. */
  @Post('notes/:id/sunat/send')
  @HttpCode(HttpStatus.CREATED)
  submitToSunat(@Param('id') id: string): Promise<SendNoteToSunatResult> {
    return this.submitStoredNote.execute(id);
  }

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

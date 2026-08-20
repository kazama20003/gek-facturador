import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import {
  CreateInvoiceUseCase,
  type CreateInvoiceResult,
} from '../../application/use-cases/create-invoice.use-case';
import {
  GenerateInvoiceXmlUseCase,
  type GenerateInvoiceXmlResult,
} from '../../application/use-cases/generate-invoice-xml.use-case';
import {
  SignInvoiceXmlUseCase,
  type SignInvoiceXmlResult,
} from '../../application/use-cases/sign-invoice-xml.use-case';
import {
  SendInvoiceToSunatUseCase,
  type SendInvoiceToSunatResult,
} from '../../application/use-cases/send-invoice-to-sunat.use-case';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

/** HTTP adapter — translates the DTO to a command; no business logic here. */
@Controller('invoices')
export class InvoiceController {
  constructor(
    private readonly createInvoice: CreateInvoiceUseCase,
    @Inject(GenerateInvoiceXmlUseCase)
    private readonly generateInvoiceXml: GenerateInvoiceXmlUseCase,
    @Inject(SignInvoiceXmlUseCase)
    private readonly signInvoiceXml: SignInvoiceXmlUseCase,
    @Inject(SendInvoiceToSunatUseCase)
    private readonly sendInvoiceToSunat: SendInvoiceToSunatUseCase,
  ) {}

  /** Temporary development endpoint — signs, zips and submits to SUNAT (beta by default). */
  @Post('sunat/send')
  @HttpCode(HttpStatus.CREATED)
  async sendToSunat(
    @Body() dto: CreateInvoiceDto,
  ): Promise<SendInvoiceToSunatResult> {
    const invoice = this.createInvoice.buildAggregate(dto);
    return this.sendInvoiceToSunat.execute(invoice);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateInvoiceDto): CreateInvoiceResult {
    return this.createInvoice.execute(dto);
  }

  /** Temporary development endpoint — not a public API. Returns the unsigned UBL XML. */
  @Post('xml')
  @HttpCode(HttpStatus.CREATED)
  @Header('Content-Type', 'application/xml')
  async createXml(@Body() dto: CreateInvoiceDto): Promise<string> {
    const invoice = this.createInvoice.buildAggregate(dto);
    const result = await this.generateInvoiceXml.execute(invoice);
    return result.xml;
  }

  /** Temporary development endpoint — returns the SIGNED UBL XML (XML-DSig in ExtensionContent). */
  @Post('xml/signed')
  @HttpCode(HttpStatus.CREATED)
  @Header('Content-Type', 'application/xml')
  async createSignedXml(@Body() dto: CreateInvoiceDto): Promise<string> {
    const invoice = this.createInvoice.buildAggregate(dto);
    const result = await this.signInvoiceXml.execute(invoice);
    return result.xml;
  }

  /** Temporary development endpoint — returns the signed XML plus its XSD validation. */
  @Post('xml/signed/validate')
  @HttpCode(HttpStatus.CREATED)
  async createSignedXmlAndValidate(
    @Body() dto: CreateInvoiceDto,
  ): Promise<SignInvoiceXmlResult> {
    const invoice = this.createInvoice.buildAggregate(dto);
    return this.signInvoiceXml.execute(invoice);
  }

  /** Temporary development endpoint — returns the XML plus its XSD validation result. */
  @Post('xml/validate')
  @HttpCode(HttpStatus.CREATED)
  async createXmlAndValidate(
    @Body() dto: CreateInvoiceDto,
  ): Promise<GenerateInvoiceXmlResult> {
    const invoice = this.createInvoice.buildAggregate(dto);
    return this.generateInvoiceXml.execute(invoice);
  }
}

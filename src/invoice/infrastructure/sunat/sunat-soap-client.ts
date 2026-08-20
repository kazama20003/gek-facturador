import type {
  SunatBillSender,
  SunatSendResult,
} from '../../application/ports/sunat-bill-sender.port';
import { buildSendBillEnvelope } from './soap-envelope';
import { extractCdrXmlFromZip, parseCdrXml } from './cdr-parser';

/** SEE del Contribuyente — homologation/beta endpoint. */
export const SUNAT_BETA_ENDPOINT =
  'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService';

export interface SunatSoapConfig {
  endpoint: string;
  /** RUC + SOL user, e.g. "20000000001MODDATOS" (beta accepts MODDATOS/moddatos). */
  username: string;
  password: string;
  timeoutMs?: number;
}

export class SunatSoapFaultError extends Error {
  constructor(
    readonly faultCode: string,
    readonly faultMessage: string,
  ) {
    super(`SUNAT SOAP fault ${faultCode}: ${faultMessage}`);
    this.name = 'SunatSoapFaultError';
  }
}

/**
 * Minimal SOAP 1.1 client for billService#sendBill over Node's built-in fetch.
 * Parses the applicationResponse (base64 CDR ZIP) or surfaces the SOAP fault
 * (faultcode is SUNAT's numeric error, e.g. 0111, 2335).
 */
export class SunatSoapClient implements SunatBillSender {
  constructor(private readonly config: SunatSoapConfig) {}

  async send(
    zipFileName: string,
    zipContent: Buffer,
  ): Promise<SunatSendResult> {
    const envelope = buildSendBillEnvelope({
      username: this.config.username,
      password: this.config.password,
      zipFileName,
      zipBase64: zipContent.toString('base64'),
    });

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
      body: envelope,
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 60_000),
    });

    const responseText = await response.text();

    const fault = responseText.match(
      /<faultcode[^>]*>([\s\S]*?)<\/faultcode>[\s\S]*?<faultstring[^>]*>([\s\S]*?)<\/faultstring>/,
    );
    if (fault) {
      throw new SunatSoapFaultError(fault[1].trim(), fault[2].trim());
    }
    if (!response.ok) {
      throw new Error(
        `SUNAT HTTP ${response.status}: ${responseText.slice(0, 300)}`,
      );
    }

    const content = responseText.match(
      /<applicationResponse[^>]*>([\s\S]*?)<\/applicationResponse>/,
    );
    if (!content) {
      throw new Error(
        `Unexpected SUNAT response: ${responseText.slice(0, 300)}`,
      );
    }

    const cdrZipBase64 = content[1].trim();
    const cdrXml = await extractCdrXmlFromZip(
      Buffer.from(cdrZipBase64, 'base64'),
    );
    return { cdr: parseCdrXml(cdrXml), cdrZipBase64 };
  }
}

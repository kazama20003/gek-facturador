import { create } from 'xmlbuilder2';
import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces';

const SOAP_ENV = 'http://schemas.xmlsoap.org/soap/envelope/';
const WSSE =
  'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';
const SUNAT_SERVICE = 'http://service.sunat.gob.pe';

interface Credentials {
  username: string;
  password: string;
}

/**
 * SOAP 1.1 envelope with the WS-Security UsernameToken that SUNAT requires
 * (SOL credentials: username = RUC + SOL user, e.g. "20000000001MODDATOS").
 * Built with xmlbuilder2 so credentials and payload are safely escaped.
 */
function envelopeWithSecurity(credentials: Credentials): {
  doc: XMLBuilder;
  body: XMLBuilder;
} {
  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const envelope = doc
    .ele(SOAP_ENV, 'soapenv:Envelope')
    .att('xmlns:ser', SUNAT_SERVICE)
    .att('xmlns:wsse', WSSE);

  const security = envelope
    .ele(SOAP_ENV, 'soapenv:Header')
    .ele(WSSE, 'wsse:Security');
  const token = security.ele(WSSE, 'wsse:UsernameToken');
  token.ele(WSSE, 'wsse:Username').txt(credentials.username);
  token.ele(WSSE, 'wsse:Password').txt(credentials.password);

  return { doc, body: envelope.ele(SOAP_ENV, 'soapenv:Body') };
}

export function buildSendBillEnvelope(
  params: Credentials & { zipFileName: string; zipBase64: string },
): string {
  const { doc, body } = envelopeWithSecurity(params);
  const operation = body.ele(SUNAT_SERVICE, 'ser:sendBill');
  operation.ele('fileName').txt(params.zipFileName);
  operation.ele('contentFile').txt(params.zipBase64);
  return doc.end();
}

export function buildSendSummaryEnvelope(
  params: Credentials & { zipFileName: string; zipBase64: string },
): string {
  const { doc, body } = envelopeWithSecurity(params);
  const operation = body.ele(SUNAT_SERVICE, 'ser:sendSummary');
  operation.ele('fileName').txt(params.zipFileName);
  operation.ele('contentFile').txt(params.zipBase64);
  return doc.end();
}

export function buildGetStatusEnvelope(
  params: Credentials & { ticket: string },
): string {
  const { doc, body } = envelopeWithSecurity(params);
  body.ele(SUNAT_SERVICE, 'ser:getStatus').ele('ticket').txt(params.ticket);
  return doc.end();
}

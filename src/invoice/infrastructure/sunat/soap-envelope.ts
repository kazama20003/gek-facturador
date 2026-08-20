import { create } from 'xmlbuilder2';

const SOAP_ENV = 'http://schemas.xmlsoap.org/soap/envelope/';
const WSSE =
  'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';
const SUNAT_SERVICE = 'http://service.sunat.gob.pe';

/**
 * Builds the SOAP 1.1 envelope for billService#sendBill with the
 * WS-Security UsernameToken that SUNAT requires (SOL credentials:
 * username = RUC + SOL user, e.g. "20000000001MODDATOS").
 * Built with xmlbuilder2 so credentials and payload are safely escaped.
 */
export function buildSendBillEnvelope(params: {
  username: string;
  password: string;
  zipFileName: string;
  zipBase64: string;
}): string {
  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const envelope = doc
    .ele(SOAP_ENV, 'soapenv:Envelope')
    .att('xmlns:ser', SUNAT_SERVICE)
    .att('xmlns:wsse', WSSE);

  const security = envelope
    .ele(SOAP_ENV, 'soapenv:Header')
    .ele(WSSE, 'wsse:Security');
  const token = security.ele(WSSE, 'wsse:UsernameToken');
  token.ele(WSSE, 'wsse:Username').txt(params.username);
  token.ele(WSSE, 'wsse:Password').txt(params.password);

  const body = envelope
    .ele(SOAP_ENV, 'soapenv:Body')
    .ele(SUNAT_SERVICE, 'ser:sendBill');
  body.ele('fileName').txt(params.zipFileName);
  body.ele('contentFile').txt(params.zipBase64);

  return doc.end();
}

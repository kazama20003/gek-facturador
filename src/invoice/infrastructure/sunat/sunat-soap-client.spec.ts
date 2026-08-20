import JSZip from 'jszip';
import { SunatSoapClient, SunatSoapFaultError } from './sunat-soap-client';

const client = new SunatSoapClient({
  endpoint: 'https://sunat.test/billService',
  username: '20000000001MODDATOS',
  password: 'moddatos',
});

function soapResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

async function cdrZipBase64(): Promise<string> {
  const zip = new JSZip();
  zip.file(
    'R-20000000001-01-F001-1.xml',
    `<?xml version="1.0"?>
<ar:ApplicationResponse xmlns:ar="urn:x" xmlns:cac="urn:y" xmlns:cbc="urn:z">
  <cac:DocumentResponse><cac:Response>
    <cbc:ResponseCode>0</cbc:ResponseCode>
    <cbc:Description>aceptada</cbc:Description>
  </cac:Response></cac:DocumentResponse>
</ar:ApplicationResponse>`,
  );
  return (await zip.generateAsync({ type: 'nodebuffer' })).toString('base64');
}

describe('SunatSoapClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('parses the CDR from a successful sendBill response', async () => {
    const base64 = await cdrZipBase64();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        soapResponse(
          `<soap:Envelope xmlns:soap="urn:s"><soap:Body><br:sendBillResponse xmlns:br="urn:b"><applicationResponse>${base64}</applicationResponse></br:sendBillResponse></soap:Body></soap:Envelope>`,
        ),
      );

    const result = await client.send(
      '20000000001-01-F001-1.zip',
      Buffer.from('zip'),
    );

    expect(result.cdr.accepted).toBe(true);
    expect(result.cdr.description).toBe('aceptada');
    expect(result.cdrZipBase64).toBe(base64);
  });

  it('sends the WS-Security credentials and file name in the envelope', async () => {
    const base64 = await cdrZipBase64();
    const spy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        soapResponse(
          `<e><Body><r><applicationResponse>${base64}</applicationResponse></r></Body></e>`,
        ),
      );

    await client.send('20000000001-01-F001-1.zip', Buffer.from('zip-bytes'));

    const body = (spy.mock.calls[0][1] as RequestInit).body as string;
    expect(body).toContain(
      '<wsse:Username>20000000001MODDATOS</wsse:Username>',
    );
    expect(body).toContain('<fileName>20000000001-01-F001-1.zip</fileName>');
    expect(body).toContain(Buffer.from('zip-bytes').toString('base64'));
  });

  it('surfaces SOAP faults with the SUNAT error code', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          `<soap:Envelope xmlns:soap="urn:s"><soap:Body><soap:Fault><faultcode>soap-env:Client.0111</faultcode><faultstring>No tiene el perfil para enviar comprobantes electronicos</faultstring></soap:Fault></soap:Body></soap:Envelope>`,
          { status: 500 },
        ),
      );

    await expect(client.send('f.zip', Buffer.from('x'))).rejects.toThrow(
      SunatSoapFaultError,
    );
  });
});

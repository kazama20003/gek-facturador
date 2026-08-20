import { buildSendBillEnvelope } from './soap-envelope';

describe('buildSendBillEnvelope', () => {
  const envelope = buildSendBillEnvelope({
    username: '20000000001MODDATOS',
    password: 'moddatos',
    zipFileName: '20000000001-01-F001-1.zip',
    zipBase64: 'UEsDBA==',
  });

  it('builds a SOAP 1.1 envelope with WS-Security UsernameToken', () => {
    expect(envelope).toContain('http://schemas.xmlsoap.org/soap/envelope/');
    expect(envelope).toContain(
      '<wsse:Username>20000000001MODDATOS</wsse:Username>',
    );
    expect(envelope).toContain('<wsse:Password>moddatos</wsse:Password>');
    expect(envelope).toContain('<ser:sendBill>');
    expect(envelope).toContain(
      '<fileName>20000000001-01-F001-1.zip</fileName>',
    );
    expect(envelope).toContain('<contentFile>UEsDBA==</contentFile>');
  });

  it('escapes credentials safely', () => {
    const withSpecials = buildSendBillEnvelope({
      username: 'user<&>',
      password: 'p&ss<w>ord',
      zipFileName: 'f.zip',
      zipBase64: 'AA==',
    });
    expect(withSpecials).toContain('user&lt;&amp;&gt;');
    expect(withSpecials).toContain('p&amp;ss&lt;w&gt;ord');
    expect(withSpecials).not.toContain('p&ss<w>ord');
  });
});

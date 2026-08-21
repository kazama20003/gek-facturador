import { createElement as h, type ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import { toDataURL } from 'qrcode';
import { Invoice } from '../../domain/aggregates/invoice';
import type { AmountInWordsConverter } from '../../application/ports/amount-in-words-converter.port';
import type { InvoicePdfGenerator } from '../../application/ports/invoice-pdf-generator.port';
import { buildSunatQrContent, extractSignatureDigest } from './sunat-qr';

/**
 * @react-pdf/renderer is ESM-only, so it is loaded through a dynamic import()
 * (the CommonJS build otherwise fails to `require()` it). This is the subset
 * of primitives the layout uses.
 */
type ReactPdf = typeof import('@react-pdf/renderer');

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  '01': 'FACTURA ELECTRÓNICA',
  '03': 'BOLETA DE VENTA ELECTRÓNICA',
};

const IDENTITY_LABELS: Record<string, string> = {
  '6': 'RUC',
  '1': 'DNI',
  '4': 'C.E.',
  '7': 'PASAPORTE',
  '0': 'DOC.',
};

const CURRENCY_SYMBOLS: Record<string, string> = { PEN: 'S/', USD: 'US$' };

const isZero = (amount: string): boolean => Number(amount) === 0;

const styles = {
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#111' },
  header: { flexDirection: 'row', marginBottom: 12 },
  issuer: { flex: 1, paddingRight: 12 },
  issuerName: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  issuerLine: { marginTop: 2 },
  docBox: {
    width: 200,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
  },
  docBoxRuc: { fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  docBoxTitle: {
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  docBoxNumber: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  section: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    padding: 6,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { fontFamily: 'Helvetica-Bold', width: 90 },
  value: { flex: 1 },
  table: { borderWidth: 1, borderColor: '#999', borderRadius: 4 },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#ddd' },
  cell: { padding: 4 },
  cCode: { width: 60 },
  cDesc: { flex: 1 },
  cQty: { width: 45, textAlign: 'right' },
  cUnit: { width: 40, textAlign: 'center' },
  cUnitValue: { width: 60, textAlign: 'right' },
  cAmount: { width: 65, textAlign: 'right' },
  footer: { flexDirection: 'row', marginTop: 10 },
  footerLeft: { flex: 1, paddingRight: 12 },
  qr: { width: 110, height: 110, marginTop: 8 },
  words: { fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  legend: { marginBottom: 4 },
  paymentBox: { marginBottom: 4 },
  cuotaRow: { flexDirection: 'row', marginTop: 1 },
  cuotaId: { width: 70 },
  cuotaDate: { width: 80 },
  cuotaAmount: { flex: 1, textAlign: 'right', paddingRight: 40 },
  totals: { width: 200 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontFamily: 'Helvetica-Bold' },
  grandTotal: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 2 },
} as const;

/** react-pdf renderer for the SUNAT printed representation. No network access. */
export class ReactInvoicePdfGenerator implements InvoicePdfGenerator {
  constructor(private readonly amountInWords: AmountInWordsConverter) {}

  async generate(invoice: Invoice, signedXml: string): Promise<Buffer> {
    const rp: ReactPdf = await import('@react-pdf/renderer');
    const digest = extractSignatureDigest(signedXml);
    const qrContent = buildSunatQrContent(invoice, digest);
    const qrDataUri = await toDataURL(qrContent, { margin: 1, width: 220 });
    return rp.renderToBuffer(this.document(rp, invoice, qrDataUri));
  }

  private document(
    rp: ReactPdf,
    invoice: Invoice,
    qrDataUri: string,
  ): ReactElement<DocumentProps> {
    const symbol = CURRENCY_SYMBOLS[invoice.currency] ?? invoice.currency;
    const money = (value: string): string => `${symbol} ${value}`;
    return h(
      rp.Document,
      null,
      h(
        rp.Page,
        { size: 'A4', style: styles.page },
        this.header(rp, invoice),
        this.customer(rp, invoice),
        this.items(rp, invoice, money),
        this.footer(rp, invoice, qrDataUri, money),
      ),
    );
  }

  private header(rp: ReactPdf, invoice: Invoice): ReactElement {
    const { View, Text } = rp;
    const address = invoice.issuer.address;
    const addressLine = address
      ? `${address.addressLine} - ${address.district}, ${address.province}, ${address.department}`
      : undefined;
    const title =
      DOCUMENT_TYPE_LABELS[invoice.documentType] ?? 'COMPROBANTE ELECTRÓNICO';
    return h(
      View,
      { style: styles.header },
      h(
        View,
        { style: styles.issuer },
        h(Text, { style: styles.issuerName }, invoice.issuer.businessName),
        invoice.issuer.tradeName
          ? h(Text, { style: styles.issuerLine }, invoice.issuer.tradeName)
          : null,
        addressLine ? h(Text, { style: styles.issuerLine }, addressLine) : null,
      ),
      h(
        View,
        { style: styles.docBox },
        h(
          Text,
          { style: styles.docBoxRuc },
          `RUC ${invoice.issuer.ruc.toString()}`,
        ),
        h(Text, { style: styles.docBoxTitle }, title),
        h(Text, { style: styles.docBoxNumber }, this.documentNumber(invoice)),
      ),
    );
  }

  private customer(rp: ReactPdf, invoice: Invoice): ReactElement {
    const identity = invoice.customer.identity;
    const idLabel = IDENTITY_LABELS[identity.code] ?? 'DOC.';
    return h(
      rp.View,
      { style: styles.section },
      this.field(rp, 'Cliente:', invoice.customer.businessName),
      this.field(rp, `${idLabel}:`, identity.toString()),
      this.field(
        rp,
        'Fecha emisión:',
        invoice.issueDate.toISOString().slice(0, 10),
      ),
      this.field(rp, 'Moneda:', invoice.currency),
    );
  }

  private items(
    rp: ReactPdf,
    invoice: Invoice,
    money: (value: string) => string,
  ): ReactElement {
    const { View, Text } = rp;
    const head = h(
      View,
      { style: styles.tableHead },
      h(Text, { style: [styles.cell, styles.cCode] }, 'Código'),
      h(Text, { style: [styles.cell, styles.cDesc] }, 'Descripción'),
      h(Text, { style: [styles.cell, styles.cQty] }, 'Cant.'),
      h(Text, { style: [styles.cell, styles.cUnit] }, 'Unid.'),
      h(Text, { style: [styles.cell, styles.cUnitValue] }, 'V. Unit.'),
      h(Text, { style: [styles.cell, styles.cAmount] }, 'Importe'),
    );
    const rows = invoice.lines.map((line, index) =>
      h(
        View,
        { style: styles.tableRow, key: String(index) },
        h(Text, { style: [styles.cell, styles.cCode] }, line.code ?? '-'),
        h(Text, { style: [styles.cell, styles.cDesc] }, line.description),
        h(
          Text,
          { style: [styles.cell, styles.cQty] },
          line.quantity.toString(),
        ),
        h(Text, { style: [styles.cell, styles.cUnit] }, line.unitCode),
        h(
          Text,
          { style: [styles.cell, styles.cUnitValue] },
          money(line.unitValue.toFixed()),
        ),
        h(
          Text,
          { style: [styles.cell, styles.cAmount] },
          money(line.total.toFixed()),
        ),
      ),
    );
    return h(View, { style: styles.table }, head, ...rows);
  }

  private footer(
    rp: ReactPdf,
    invoice: Invoice,
    qrDataUri: string,
    money: (value: string) => string,
  ): ReactElement {
    const { View, Text, Image } = rp;
    const legend = `SON: ${this.amountInWords.convert(invoice.total)}`;
    return h(
      View,
      { style: styles.footer },
      h(
        View,
        { style: styles.footerLeft },
        h(Text, { style: styles.words }, legend),
        this.paymentTerms(rp, invoice, money),
        this.detractionLegend(rp, invoice, money),
        h(Image, { style: styles.qr, src: qrDataUri }),
      ),
      h(
        View,
        { style: styles.totals },
        this.totalLine(
          rp,
          'Op. Gravada:',
          money(invoice.taxableAmount.toFixed()),
        ),
        isZero(invoice.exoneratedAmount.toFixed())
          ? null
          : this.totalLine(
              rp,
              'Op. Exonerada:',
              money(invoice.exoneratedAmount.toFixed()),
            ),
        isZero(invoice.unaffectedAmount.toFixed())
          ? null
          : this.totalLine(
              rp,
              'Op. Inafecta:',
              money(invoice.unaffectedAmount.toFixed()),
            ),
        isZero(invoice.freeAmount.toFixed())
          ? null
          : this.totalLine(
              rp,
              'Op. Gratuita:',
              money(invoice.freeAmount.toFixed()),
            ),
        isZero(invoice.globalDiscount.toFixed())
          ? null
          : this.totalLine(
              rp,
              'Descuento global:',
              `- ${money(invoice.globalDiscount.toFixed())}`,
            ),
        this.totalLine(rp, 'IGV (18%):', money(invoice.igv.toFixed())),
        isZero(invoice.freeIgv.toFixed())
          ? null
          : this.totalLine(
              rp,
              'IGV gratuitas:',
              money(invoice.freeIgv.toFixed()),
            ),
        this.totalLine(
          rp,
          'IMPORTE TOTAL:',
          money(invoice.total.toFixed()),
          styles.grandTotal,
        ),
      ),
    );
  }

  private paymentTerms(
    rp: ReactPdf,
    invoice: Invoice,
    money: (value: string) => string,
  ): ReactElement {
    const { View, Text } = rp;
    const terms = invoice.paymentTerms;
    if (!terms.isCredit) {
      return h(Text, { style: styles.legend }, 'Condición de pago: CONTADO');
    }
    const pending = terms.pendingAmount?.toFixed() ?? invoice.total.toFixed();
    const rows = terms.installments.map((installment) =>
      h(
        View,
        { style: styles.cuotaRow, key: installment.id },
        h(Text, { style: styles.cuotaId }, installment.id),
        h(
          Text,
          { style: styles.cuotaDate },
          installment.dueDate.toISOString().slice(0, 10),
        ),
        h(
          Text,
          { style: styles.cuotaAmount },
          money(installment.amount.toFixed()),
        ),
      ),
    );
    return h(
      View,
      { style: styles.paymentBox },
      h(
        Text,
        { style: styles.legend },
        `Condición de pago: CRÉDITO — Pendiente ${money(pending)}`,
      ),
      ...rows,
    );
  }

  private detractionLegend(
    rp: ReactPdf,
    invoice: Invoice,
    money: (value: string) => string,
  ): ReactElement | null {
    const detraction = invoice.detraction;
    if (!detraction) {
      return null;
    }
    return h(
      rp.Text,
      { style: styles.legend },
      `Operación sujeta a detracción — Código ${detraction.code} ` +
        `(${detraction.percent}%) — Cuenta BN ${detraction.account} — ` +
        `Monto ${money(detraction.amount.toFixed())}`,
    );
  }

  private documentNumber(invoice: Invoice): string {
    const correlative = String(invoice.correlative.toNumber()).padStart(8, '0');
    return `${invoice.series.toString()}-${correlative}`;
  }

  private field(rp: ReactPdf, label: string, value: string): ReactElement {
    return h(
      rp.View,
      { style: styles.row },
      h(rp.Text, { style: styles.label }, label),
      h(rp.Text, { style: styles.value }, value),
    );
  }

  private totalLine(
    rp: ReactPdf,
    label: string,
    value: string,
    extra?: (typeof styles)[keyof typeof styles],
  ): ReactElement {
    const rowStyle = extra ? [styles.totalRow, extra] : styles.totalRow;
    return h(
      rp.View,
      { style: rowStyle },
      h(rp.Text, { style: styles.totalLabel }, label),
      h(rp.Text, null, value),
    );
  }
}

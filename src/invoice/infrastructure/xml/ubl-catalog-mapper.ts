import { IgvAffectationType } from '../../domain/value-objects/igv-affectation-type';
import { IGV_RATE } from '../../domain/services/igv';

/**
 * SUNAT catalog codes and list metadata used in the UBL invoice.
 * Single source for tax codes — never repeated as magic strings in the generator.
 * Catalogs: cpe.sunat.gob.pe (anexos de la R.S. 097-2012 y modificatorias).
 */
export const SUNAT_CATALOGS = {
  /** Catalog 01 — document type. */
  documentType: {
    invoice: '01',
    listAgencyName: 'PE:SUNAT',
    listName: 'Tipo de Documento',
    listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01',
  },
  /** Catalog 51 — operation type. Only internal sale is supported for now. */
  operationType: {
    internalSale: '0101',
    listName: 'Tipo de Operacion',
    listSchemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo51',
  },
  /** Catalog 06 — identity document type. */
  identityDocumentType: {
    ruc: '6',
    schemeAgencyName: 'PE:SUNAT',
    schemeName: 'Documento de Identidad',
    schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06',
  },
  /** Catalog 05 — tax types. */
  tax: {
    igv: { id: '1000', name: 'IGV', typeCode: 'VAT' },
    schemeName: 'Codigo de tributos',
    schemeAgencyName: 'PE:SUNAT',
    schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo05',
  },
  /** Catalog 07 — IGV affectation. Codes live in the domain value object. */
  igvAffectation: {
    listAgencyName: 'PE:SUNAT',
    listName: 'Afectacion del IGV',
    listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07',
  },
  /** Catalog 16 — price type. 01 = unit price incl. IGV, 02 = referential value (free). */
  priceType: {
    unitPriceIncludingIgv: '01',
    referentialValue: '02',
    listName: 'Tipo de Precio',
    listAgencyName: 'PE:SUNAT',
    listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16',
  },
  /** Catalog 53 — allowance/charge reason. 02 = global discount affecting the base. */
  discount: {
    globalAffectsBase: '02',
    listAgencyName: 'PE:SUNAT',
    listName: 'Cargo/descuento',
    listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo53',
  },
  /** Catalog 52 — legends. 1000 = amount in words. */
  legend: {
    amountInWords: '1000',
  },
  /** Forma de pago (R.S. 193-2020, error 3244 if missing). */
  paymentTerms: {
    id: 'FormaPago',
    cash: 'Contado',
    credit: 'Credito',
  },
  currency: {
    listID: 'ISO 4217 Alpha',
    listName: 'Currency',
    listAgencyName: 'United Nations Economic Commission for Europe',
  },
  unit: {
    unitCodeListID: 'UN/ECE rec 20',
    unitCodeListAgencyName: 'United Nations Economic Commission for Europe',
  },
  ubigeo: {
    schemeAgencyName: 'PE:INEI',
    schemeName: 'Ubigeos',
  },
  establishment: {
    /** Main establishment (anexo) code assigned by SUNAT. */
    main: '0000',
    listAgencyName: 'PE:SUNAT',
    listName: 'Establecimientos anexos',
  },
} as const;

/** SUNAT UBL customization for invoices (Resolución 340-2017 y guía UBL 2.1). */
export const UBL_VERSION = '2.1';
export const CUSTOMIZATION_ID = '2.0';

/**
 * Signature reference identifier. The ds:Signature inserted later in
 * ext:ExtensionContent must use this same Id so the declarative
 * cac:Signature reference resolves.
 */
export const SIGNATURE_ID = 'IDSignSP';

/** IGV percent with two decimals, derived from the domain rate (0.18 → 18.00). */
export const IGV_PERCENT = (Number(IGV_RATE) * 100).toFixed(2);

export function igvAffectationCode(type: IgvAffectationType): string {
  return type.sunatCode;
}

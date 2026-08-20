/**
 * UBL 2.1 namespace URIs, taken from the OASIS UBL 2.1 specification and the
 * SUNAT electronic invoice guides (cpe.sunat.gob.pe/guias-y-manuales).
 */
export const UBL_NAMESPACES = {
  invoice: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  ccts: 'urn:un:unece:uncefact:documentation:2',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  ext: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  qdt: 'urn:oasis:names:specification:ubl:schema:xsd:QualifiedDataTypes-2',
  sac: 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1',
  udt: 'urn:oasis:names:specification:ubl:schema:xsd:UnqualifiedDataTypes-2',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
} as const;

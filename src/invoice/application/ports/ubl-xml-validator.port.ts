export interface XmlValidationError {
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
}

export interface XmlValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<XmlValidationError>;
}

/**
 * Port: structural validation of a UBL XML document.
 * Covers well-formedness and XSD validity only — passing this does NOT mean
 * the document satisfies every SUNAT business rule nor that SUNAT will accept it.
 */
export interface UblXmlValidator {
  validate(xml: string): Promise<XmlValidationResult>;
}

export const UBL_XML_VALIDATOR = Symbol('UblXmlValidator');

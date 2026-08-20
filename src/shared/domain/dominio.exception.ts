/**
 * Excepción base del dominio. Representa violación de una regla de negocio.
 * La infraestructura la traduce a errores HTTP; el dominio no conoce HTTP.
 */
export class DominioException extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

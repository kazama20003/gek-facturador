/**
 * Base class for all domain errors. Presentation translates these to HTTP;
 * the domain itself knows nothing about transport concerns.
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

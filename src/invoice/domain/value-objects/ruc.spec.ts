import { InvalidRucError } from '../errors/invoice-errors';
import { Ruc } from './ruc';

describe('Ruc', () => {
  it('accepts a valid RUC with correct check digit', () => {
    expect(Ruc.create('20100070970').toString()).toBe('20100070970');
    expect(Ruc.create('20000000001').toString()).toBe('20000000001');
  });

  it('rejects wrong length', () => {
    expect(() => Ruc.create('123')).toThrow(InvalidRucError);
    expect(() => Ruc.create('201000709701')).toThrow(InvalidRucError);
  });

  it('rejects non-numeric characters', () => {
    expect(() => Ruc.create('20100070A70')).toThrow(InvalidRucError);
  });

  it('rejects an invalid check digit', () => {
    expect(() => Ruc.create('20123456789')).toThrow(InvalidRucError);
    expect(() => Ruc.create('20100070971')).toThrow(InvalidRucError);
  });

  it('has value equality', () => {
    expect(Ruc.create('20100070970').equals(Ruc.create('20100070970'))).toBe(
      true,
    );
  });
});

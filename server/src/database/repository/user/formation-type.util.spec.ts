import { formationTypePredicate, FormationType } from './formation-type.util';

describe('formationTypePredicate', () => {
  it('fundae → columna funding = FUNDAE', () => {
    expect(formationTypePredicate('fundae')).toEqual({ column: 'funding', value: 'FUNDAE' });
  });

  it('publica → columna funding = PUBLICA', () => {
    expect(formationTypePredicate('publica')).toEqual({ column: 'funding', value: 'PUBLICA' });
  });

  it('inaem → columna client = INAEM (no funding: es el cliente concreto)', () => {
    expect(formationTypePredicate('inaem')).toEqual({ column: 'client', value: 'INAEM' });
  });

  it('privada → columna funding = PRIVADA (privada no bonificada)', () => {
    expect(formationTypePredicate('privada')).toEqual({ column: 'funding', value: 'PRIVADA' });
  });

  it('inaem es el único que filtra por client; el resto por funding', () => {
    const types: FormationType[] = ['fundae', 'publica', 'inaem', 'privada'];
    const byClient = types.filter((t) => formationTypePredicate(t).column === 'client');
    expect(byClient).toEqual(['inaem']);
  });
});

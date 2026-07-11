import { parseRadioCommand } from '../../src/radio/parseRadioCommand';

const P = '.';

describe('parseRadioCommand', () => {
  it('só o comando vira ajuda', () => {
    expect(parseRadioCommand('.radio', P)).toEqual({ kind: 'help' });
  });

  it('país/termo vira lookup', () => {
    expect(parseRadioCommand('.radio Brazil', P)).toEqual({
      kind: 'lookup',
      query: 'Brazil',
    });
  });

  it('"search" vira busca livre', () => {
    expect(parseRadioCommand('.radio search jazz lofi', P)).toEqual({
      kind: 'search',
      query: 'jazz lofi',
    });
  });

  it('"stop" vira stop', () => {
    expect(parseRadioCommand('.radio stop', P)).toEqual({ kind: 'stop' });
  });

  it('aceita o atalho curto "s" (search)', () => {
    expect(parseRadioCommand('.radio s jazz', P)).toEqual({
      kind: 'search',
      query: 'jazz',
    });
  });

  it('aceita o alias de comando "r"', () => {
    expect(parseRadioCommand('.r Tokyo', P)).toEqual({
      kind: 'lookup',
      query: 'Tokyo',
    });
  });

  it('aceita os sinônimos em português (buscar/parar)', () => {
    expect(parseRadioCommand('.radio buscar jazz', P)).toEqual({
      kind: 'search',
      query: 'jazz',
    });
    expect(parseRadioCommand('.radio parar', P)).toEqual({ kind: 'stop' });
  });

  it('"search" sem termo vira ajuda', () => {
    expect(parseRadioCommand('.radio search', P)).toEqual({ kind: 'help' });
  });

  it('ignora prefixo diferente', () => {
    expect(parseRadioCommand('#radio Brazil', P)).toBeNull();
  });

  it('ignora comandos que não são de rádio', () => {
    expect(parseRadioCommand('.play foo', P)).toBeNull();
  });
});

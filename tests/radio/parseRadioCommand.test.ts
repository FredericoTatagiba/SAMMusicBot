import { parseRadioCommand } from '../../src/radio/parseRadioCommand';

const P = '.';

describe('parseRadioCommand', () => {
  it('só o comando vira ajuda', () => {
    expect(parseRadioCommand('.radio', P)).toEqual({ kind: 'help' });
  });

  it('país/termo vira lookup', () => {
    expect(parseRadioCommand('.radio Brasil', P)).toEqual({
      kind: 'lookup',
      query: 'Brasil',
    });
  });

  it('"buscar" vira busca livre', () => {
    expect(parseRadioCommand('.radio buscar jazz lofi', P)).toEqual({
      kind: 'search',
      query: 'jazz lofi',
    });
  });

  it('"parar" vira stop', () => {
    expect(parseRadioCommand('.radio parar', P)).toEqual({ kind: 'stop' });
  });

  it('aceita o alias "r"', () => {
    expect(parseRadioCommand('.r Tokyo', P)).toEqual({
      kind: 'lookup',
      query: 'Tokyo',
    });
  });

  it('aceita os atalhos curtos b (buscar) e p (parar)', () => {
    expect(parseRadioCommand('.radio b jazz', P)).toEqual({
      kind: 'search',
      query: 'jazz',
    });
    expect(parseRadioCommand('.radio p', P)).toEqual({ kind: 'stop' });
  });

  it('"buscar" sem termo vira ajuda', () => {
    expect(parseRadioCommand('.radio buscar', P)).toEqual({ kind: 'help' });
  });

  it('ignora prefixo diferente', () => {
    expect(parseRadioCommand('#radio Brasil', P)).toBeNull();
  });

  it('ignora comandos que não são de rádio', () => {
    expect(parseRadioCommand('.play foo', P)).toBeNull();
  });
});

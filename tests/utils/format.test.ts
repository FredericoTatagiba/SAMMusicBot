import { formatDuration, truncate } from '../../src/utils/format';

describe('formatDuration', () => {
  it('formata minutos e segundos', () => {
    expect(formatDuration(185_000)).toBe('3:05');
  });

  it('formata horas', () => {
    expect(formatDuration(3_661_000)).toBe('1:01:01');
  });

  it('trata duração desconhecida como ao vivo', () => {
    expect(formatDuration(0)).toBe('🔴 ao vivo');
    expect(formatDuration(-1)).toBe('🔴 ao vivo');
  });
});

describe('truncate', () => {
  it('mantém textos curtos', () => {
    expect(truncate('abc', 5)).toBe('abc');
  });

  it('trunca com reticências', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
  });
});

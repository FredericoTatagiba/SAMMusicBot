import { parseCommand } from '../../src/discord/parseCommand';

describe('parseCommand', () => {
  it('extrai nome e argumentos', () => {
    expect(parseCommand('!play never gonna give', '!')).toEqual({
      name: 'play',
      args: ['never', 'gonna', 'give'],
    });
  });

  it('normaliza o nome para minúsculas', () => {
    expect(parseCommand('!PLAY x', '!')?.name).toBe('play');
  });

  it('colapsa espaços múltiplos', () => {
    expect(parseCommand('!play   a    b', '!')?.args).toEqual(['a', 'b']);
  });

  it('retorna null sem o prefixo', () => {
    expect(parseCommand('play x', '!')).toBeNull();
  });

  it('retorna null para prefixo isolado', () => {
    expect(parseCommand('!', '!')).toBeNull();
    expect(parseCommand('!   ', '!')).toBeNull();
  });

  it('suporta prefixo de múltiplos caracteres', () => {
    expect(parseCommand('!!skip', '!!')?.name).toBe('skip');
  });
});

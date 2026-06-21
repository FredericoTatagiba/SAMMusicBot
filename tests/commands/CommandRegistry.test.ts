import { CommandRegistry } from '../../src/commands/CommandRegistry';
import { ICommand } from '../../src/core/interfaces/ICommand';

function command(name: string, aliases: string[] = []): ICommand {
  return {
    name,
    aliases,
    description: 'desc',
    usage: 'usage',
    execute: async () => {},
  };
}

describe('CommandRegistry', () => {
  it('resolve por nome e por alias (case-insensitive)', () => {
    const cmd = command('play', ['p', 'tocar']);
    const registry = new CommandRegistry().register(cmd);
    expect(registry.resolve('play')).toBe(cmd);
    expect(registry.resolve('P')).toBe(cmd);
    expect(registry.resolve('TOCAR')).toBe(cmd);
    expect(registry.resolve('nada')).toBeNull();
  });

  it('all() não repete comandos com múltiplos aliases', () => {
    const registry = new CommandRegistry()
      .register(command('play', ['p']))
      .register(command('skip', ['s']));
    expect(registry.all()).toHaveLength(2);
  });

  it('rejeita nome ou alias duplicado', () => {
    const registry = new CommandRegistry().register(command('play', ['p']));
    expect(() => registry.register(command('play'))).toThrow();
    expect(() => registry.register(command('outro', ['p']))).toThrow();
  });
});

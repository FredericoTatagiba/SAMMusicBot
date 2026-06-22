import { CommandRegistry } from '../../src/commands/CommandRegistry';
import { PlayCommand } from '../../src/commands/PlayCommand';
import { SkipCommand } from '../../src/commands/SkipCommand';
import { StopCommand } from '../../src/commands/StopCommand';
import { PauseCommand } from '../../src/commands/PauseCommand';
import { ResumeCommand } from '../../src/commands/ResumeCommand';
import { QueueCommand } from '../../src/commands/QueueCommand';
import { NowPlayingCommand } from '../../src/commands/NowPlayingCommand';
import { LoopCommand } from '../../src/commands/LoopCommand';
import { ShuffleCommand } from '../../src/commands/ShuffleCommand';
import { HelpCommand } from '../../src/commands/HelpCommand';
import { SearchService } from '../../src/services/SearchService';
import { QueueManager } from '../../src/services/QueueManager';

// Dependências falsas: os comandos só as guardam, não as usam na construção.
const search = undefined as unknown as SearchService;
const qm = undefined as unknown as QueueManager;

function buildRegistry(): CommandRegistry {
  const registry = new CommandRegistry();
  registry
    .register(new PlayCommand(search, qm))
    .register(new SkipCommand(qm))
    .register(new StopCommand(qm))
    .register(new PauseCommand(qm))
    .register(new ResumeCommand(qm))
    .register(new QueueCommand(qm))
    .register(new NowPlayingCommand(qm))
    .register(new LoopCommand(qm))
    .register(new ShuffleCommand(qm))
    .register(new HelpCommand(registry, '#'));
  return registry;
}

describe('Conjunto real de comandos', () => {
  it('registra os 10 comandos sem nome/alias duplicado', () => {
    expect(() => buildRegistry()).not.toThrow();
    expect(buildRegistry().all()).toHaveLength(10);
  });

  it('os atalhos curtos resolvem para o comando correto', () => {
    const registry = buildRegistry();
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['p', 'play'],
      ['s', 'skip'],
      ['q', 'queue'],
      ['np', 'nowplaying'],
      ['h', 'help'],
      ['pa', 'pause'],
      ['r', 'resume'],
      ['l', 'loop'],
      ['sh', 'shuffle'],
      ['x', 'stop'],
    ];
    for (const [alias, name] of cases) {
      expect(registry.resolve(alias)?.name).toBe(name);
    }
  });
});

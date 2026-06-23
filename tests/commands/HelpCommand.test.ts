import { HelpCommand } from '../../src/commands/HelpCommand';
import { CommandRegistry } from '../../src/commands/CommandRegistry';
import { PlayCommand } from '../../src/commands/PlayCommand';
import { ICommandContext } from '../../src/core/interfaces/ICommand';
import { SearchService } from '../../src/services/SearchService';
import { QueueManager } from '../../src/services/QueueManager';

function makeContext(): ICommandContext & { replies: string[] } {
  const replies: string[] = [];
  return {
    guildId: 'g',
    userId: 'u',
    args: [],
    voiceChannelId: null,
    replies,
    reply: async (m: string) => {
      replies.push(m);
    },
  };
}

describe('HelpCommand', () => {
  it('lista o comando com seus atalhos (aliases)', async () => {
    const registry = new CommandRegistry();
    registry.register(
      new PlayCommand(
        undefined as unknown as SearchService,
        undefined as unknown as QueueManager,
      ),
    );
    const help = new HelpCommand(registry, '#');
    registry.register(help);

    const ctx = makeContext();
    await help.execute(ctx);

    const output = ctx.replies[0]!;
    expect(output).toContain('#play');
    expect(output).toContain('#p'); // atalho deve aparecer
    expect(output).toContain('#help');
    expect(output).toContain('uso:'); // explicação de uso
    expect(output).toContain('<nome ou link>'); // exemplo de argumentos do play
  });
});

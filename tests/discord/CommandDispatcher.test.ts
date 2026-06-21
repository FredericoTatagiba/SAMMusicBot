import { CommandDispatcher } from '../../src/discord/CommandDispatcher';
import { CommandRegistry } from '../../src/commands/CommandRegistry';
import { ICommand, ICommandContext } from '../../src/core/interfaces/ICommand';
import { CommandError } from '../../src/core/errors';
import { NullLogger } from '../helpers/fakes';

function makeContext(): ICommandContext & { replies: string[] } {
  const replies: string[] = [];
  return {
    guildId: 'g1',
    userId: 'u1',
    args: [],
    voiceChannelId: 'v1',
    replies,
    reply: async (m: string) => {
      replies.push(m);
    },
  };
}

function command(name: string, execute: ICommand['execute']): ICommand {
  return { name, aliases: [], description: '', usage: '', execute };
}

describe('CommandDispatcher', () => {
  it('executa o comando resolvido', async () => {
    const exec = jest.fn().mockResolvedValue(undefined);
    const registry = new CommandRegistry().register(command('ping', exec));
    const dispatcher = new CommandDispatcher(registry, new NullLogger());

    await dispatcher.dispatch('ping', makeContext());
    expect(exec).toHaveBeenCalled();
  });

  it('ignora comandos desconhecidos sem responder', async () => {
    const registry = new CommandRegistry();
    const dispatcher = new CommandDispatcher(registry, new NullLogger());
    const ctx = makeContext();
    await dispatcher.dispatch('inexistente', ctx);
    expect(ctx.replies).toHaveLength(0);
  });

  it('converte DomainError em resposta amigável', async () => {
    const registry = new CommandRegistry().register(
      command('boom', () => {
        throw new CommandError('entrada inválida');
      }),
    );
    const dispatcher = new CommandDispatcher(registry, new NullLogger());
    const ctx = makeContext();
    await dispatcher.dispatch('boom', ctx);
    expect(ctx.replies[0]).toContain('entrada inválida');
  });

  it('captura erros inesperados com mensagem genérica', async () => {
    const registry = new CommandRegistry().register(
      command('crash', () => {
        throw new Error('detalhe interno');
      }),
    );
    const dispatcher = new CommandDispatcher(registry, new NullLogger());
    const ctx = makeContext();
    await dispatcher.dispatch('crash', ctx);
    expect(ctx.replies[0]).toContain('erro inesperado');
    expect(ctx.replies[0]).not.toContain('detalhe interno');
  });
});

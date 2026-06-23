import { ICommand, ICommandContext } from '../core/interfaces/ICommand';
import { CommandError } from '../core/errors';
import { QueueManager } from '../services/QueueManager';

/** Pula a faixa atual. */
export class SkipCommand implements ICommand {
  readonly name = 'skip';
  readonly aliases = ['s', 'pular', 'next'] as const;
  readonly description = 'Pula a faixa atual e toca a próxima da fila.';
  readonly usage = '';

  constructor(private readonly queueManager: QueueManager) {}

  async execute(ctx: ICommandContext): Promise<void> {
    const service = this.queueManager.get(ctx.guildId);
    if (!service || !service.skip()) {
      throw new CommandError('Não há nada tocando.');
    }
    await ctx.reply('⏭️ Faixa pulada.');
  }
}

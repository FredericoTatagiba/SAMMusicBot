import { ICommand, ICommandContext } from '../core/interfaces/ICommand';
import { CommandError } from '../core/errors';
import { QueueManager } from '../services/QueueManager';

/** Embaralha as faixas pendentes da fila. */
export class ShuffleCommand implements ICommand {
  readonly name = 'shuffle';
  readonly aliases = ['embaralhar', 'sh'] as const;
  readonly description = 'Embaralha a ordem das próximas faixas.';
  readonly usage = '!shuffle';

  constructor(private readonly queueManager: QueueManager) {}

  async execute(ctx: ICommandContext): Promise<void> {
    const service = this.queueManager.get(ctx.guildId);
    if (!service || service.snapshot().upcoming.length === 0) {
      throw new CommandError('Não há faixas suficientes na fila para embaralhar.');
    }
    service.shuffle();
    await ctx.reply('🔀 Fila embaralhada.');
  }
}

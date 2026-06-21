import { ICommand, ICommandContext } from '../core/interfaces/ICommand';
import { CommandError } from '../core/errors';
import { QueueManager } from '../services/QueueManager';

/** Pausa a reprodução atual. */
export class PauseCommand implements ICommand {
  readonly name = 'pause';
  readonly aliases = ['pausar'] as const;
  readonly description = 'Pausa a faixa atual.';
  readonly usage = '!pause';

  constructor(private readonly queueManager: QueueManager) {}

  async execute(ctx: ICommandContext): Promise<void> {
    const service = this.queueManager.get(ctx.guildId);
    if (!service || !service.pause()) {
      throw new CommandError('Não há nada tocando para pausar.');
    }
    await ctx.reply('⏸️ Pausado.');
  }
}

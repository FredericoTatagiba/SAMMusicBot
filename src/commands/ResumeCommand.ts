import { ICommand, ICommandContext } from '../core/interfaces/ICommand';
import { CommandError } from '../core/errors';
import { QueueManager } from '../services/QueueManager';

/** Retoma a reprodução pausada. */
export class ResumeCommand implements ICommand {
  readonly name = 'resume';
  readonly aliases = ['retomar', 'continuar'] as const;
  readonly description = 'Retoma a faixa pausada.';
  readonly usage = '!resume';

  constructor(private readonly queueManager: QueueManager) {}

  async execute(ctx: ICommandContext): Promise<void> {
    const service = this.queueManager.get(ctx.guildId);
    if (!service || !service.resume()) {
      throw new CommandError('Não há nada pausado.');
    }
    await ctx.reply('▶️ Retomado.');
  }
}

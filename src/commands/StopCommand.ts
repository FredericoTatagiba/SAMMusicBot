import { ICommand, ICommandContext } from '../core/interfaces/ICommand';
import { CommandError } from '../core/errors';
import { QueueManager } from '../services/QueueManager';

/** Para a reprodução, limpa a fila e desconecta do canal de voz. */
export class StopCommand implements ICommand {
  readonly name = 'stop';
  readonly aliases = ['parar', 'leave', 'sair'] as const;
  readonly description = 'Para tudo, limpa a fila e sai do canal de voz.';
  readonly usage = '!stop';

  constructor(private readonly queueManager: QueueManager) {}

  async execute(ctx: ICommandContext): Promise<void> {
    const service = this.queueManager.get(ctx.guildId);
    if (!service) {
      throw new CommandError('Não estou tocando nada.');
    }
    service.stop();
    await ctx.reply('⏹️ Reprodução encerrada. Até a próxima!');
  }
}

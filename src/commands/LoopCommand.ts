import { ICommand, ICommandContext } from '../core/interfaces/ICommand';
import { CommandError } from '../core/errors';
import { QueueManager } from '../services/QueueManager';
import { LoopMode } from '../core/types';

const MODE_LABELS: Record<LoopMode, string> = {
  [LoopMode.Off]: 'desativado',
  [LoopMode.Track]: 'faixa atual',
  [LoopMode.Queue]: 'fila inteira',
};

/** Configura o modo de repetição: off | track | queue. */
export class LoopCommand implements ICommand {
  readonly name = 'loop';
  readonly aliases = ['repeat', 'repetir', 'l'] as const;
  readonly description = 'Define a repetição: off, track ou queue.';
  readonly usage = '!loop <off|track|queue>';

  constructor(private readonly queueManager: QueueManager) {}

  async execute(ctx: ICommandContext): Promise<void> {
    const service = this.queueManager.get(ctx.guildId);
    if (!service) {
      throw new CommandError('Não há nada tocando.');
    }
    const mode = this.parseMode(ctx.args[0]);
    service.setLoopMode(mode);
    await ctx.reply(`🔁 Repetição: **${MODE_LABELS[mode]}**.`);
  }

  private parseMode(raw: string | undefined): LoopMode {
    const allowed = Object.values(LoopMode) as string[];
    if (!raw || !allowed.includes(raw.toLowerCase())) {
      throw new CommandError(`Uso: ${this.usage}`);
    }
    return raw.toLowerCase() as LoopMode;
  }
}

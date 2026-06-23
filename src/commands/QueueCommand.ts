import { ICommand, ICommandContext } from '../core/interfaces/ICommand';
import { CommandError } from '../core/errors';
import { QueueManager } from '../services/QueueManager';
import { formatDuration, truncate } from '../utils/format';

/** Mostra a faixa atual e as próximas da fila. */
export class QueueCommand implements ICommand {
  readonly name = 'queue';
  readonly aliases = ['q', 'fila'] as const;
  readonly description = 'Mostra a faixa atual e as próximas da fila.';
  readonly usage = '';

  private static readonly MAX_LISTED = 10;

  constructor(private readonly queueManager: QueueManager) {}

  async execute(ctx: ICommandContext): Promise<void> {
    const service = this.queueManager.get(ctx.guildId);
    if (!service) {
      throw new CommandError('A fila está vazia.');
    }
    const { current, upcoming } = service.snapshot();
    if (!current && upcoming.length === 0) {
      throw new CommandError('A fila está vazia.');
    }

    const lines: string[] = [];
    if (current) {
      lines.push(
        `🎶 **Tocando agora:** ${truncate(current.title, 60)} \`${formatDuration(current.durationMs)}\``,
      );
    }
    if (upcoming.length > 0) {
      lines.push('', '**Próximas:**');
      upcoming.slice(0, QueueCommand.MAX_LISTED).forEach((track, index) => {
        lines.push(
          `\`${index + 1}.\` ${truncate(track.title, 50)} \`${formatDuration(track.durationMs)}\``,
        );
      });
      const remaining = upcoming.length - QueueCommand.MAX_LISTED;
      if (remaining > 0) {
        lines.push(`…e mais **${remaining}** faixa(s).`);
      }
    }
    await ctx.reply(lines.join('\n'));
  }
}

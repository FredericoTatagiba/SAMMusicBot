import { ICommand, ICommandContext } from '../core/interfaces/ICommand';
import { CommandError } from '../core/errors';
import { QueueManager } from '../services/QueueManager';
import { formatDuration } from '../utils/format';

/** Mostra detalhes da faixa que está tocando. */
export class NowPlayingCommand implements ICommand {
  readonly name = 'nowplaying';
  readonly aliases = ['np', 'agora'] as const;
  readonly description = 'Mostra a faixa que está tocando.';
  readonly usage = '!nowplaying';

  constructor(private readonly queueManager: QueueManager) {}

  async execute(ctx: ICommandContext): Promise<void> {
    const current = this.queueManager.get(ctx.guildId)?.snapshot().current;
    if (!current) {
      throw new CommandError('Não há nada tocando.');
    }
    await ctx.reply(
      [
        `🎶 **${current.title}**`,
        `👤 ${current.author}`,
        `⏱️ \`${formatDuration(current.durationMs)}\` · 📡 ${current.source}`,
        `🔗 ${current.url}`,
      ].join('\n'),
    );
  }
}

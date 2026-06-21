import { ICommand, ICommandContext } from '../core/interfaces/ICommand';
import { CommandError } from '../core/errors';
import { SearchService } from '../services/SearchService';
import { QueueManager } from '../services/QueueManager';

/** Busca e enfileira faixas; inicia a reprodução se a fila estiver ociosa. */
export class PlayCommand implements ICommand {
  readonly name = 'play';
  readonly aliases = ['p', 'tocar'] as const;
  readonly description = 'Toca uma faixa por nome ou link (YouTube, Spotify, SoundCloud).';
  readonly usage = '!play <nome ou link>';

  constructor(
    private readonly search: SearchService,
    private readonly queueManager: QueueManager,
  ) {}

  async execute(ctx: ICommandContext): Promise<void> {
    if (!ctx.voiceChannelId) {
      throw new CommandError('Entre em um canal de voz primeiro.');
    }
    const query = ctx.args.join(' ').trim();
    if (query.length === 0) {
      throw new CommandError(`Uso: ${this.usage}`);
    }

    const tracks = await this.search.search(query);
    const service = this.queueManager.getOrCreate(ctx.guildId);
    const result = await service.enqueue(tracks, ctx.voiceChannelId, ctx.userId);

    if (tracks.length === 1) {
      const title = tracks[0]!.title;
      await ctx.reply(
        result.startedPlayback
          ? `▶️ Tocando agora: **${title}**`
          : `➕ Adicionado à fila: **${title}**`,
      );
      return;
    }
    await ctx.reply(`➕ **${result.added}** faixas adicionadas à fila.`);
  }
}

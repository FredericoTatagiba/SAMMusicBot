import { Readable } from 'stream';
import { ILogger } from '../core/interfaces/ILogger';
import { AudioStream, AudioStreamType } from '../core/types';
import { StreamResolutionError } from '../core/errors';
import { IRadioStreamResolver } from './IRadioStreamResolver';

/** Contrato mínimo de fetch com corpo em stream — satisfeito pelo `fetch`. */
export interface StreamResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly body: unknown;
}
export type StreamFetch = (
  url: string,
  init?: { redirect?: 'follow'; headers?: Record<string, string> },
) => Promise<StreamResponse>;

const USER_AGENT =
  'Mozilla/5.0 (compatible; DiscordMusicBot/1.0; +https://github.com/)';

/**
 * Resolve o áudio ao vivo de uma estação. O endpoint `channel.mp3` responde
 * 302 para o stream real; seguimos o redirect e entregamos o corpo como um
 * `AudioStream` arbitrário — o ffmpeg (via @discordjs/voice) transcodifica.
 */
export class RadioStreamResolver implements IRadioStreamResolver {
  constructor(
    private readonly baseUrl: string,
    private readonly logger: ILogger,
    private readonly fetchFn: StreamFetch = fetch,
  ) {}

  async resolve(channelId: string): Promise<AudioStream> {
    const url = `${this.baseUrl}/ara/content/listen/${encodeURIComponent(
      channelId,
    )}/channel.mp3`;
    const response = await this.fetchFn(url, {
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT },
    });
    if (!response.ok || !response.body) {
      throw new StreamResolutionError(
        `Rádio indisponível (canal ${channelId}): HTTP ${response.status}.`,
      );
    }
    const stream = Readable.fromWeb(
      response.body as Parameters<typeof Readable.fromWeb>[0],
    );
    this.logger.info('Rádio: stream resolvido', { channelId });
    return { stream, type: AudioStreamType.Arbitrary };
  }
}

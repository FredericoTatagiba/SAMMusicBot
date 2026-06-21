import play from 'play-dl';
import { IStreamResolver } from '../../core/interfaces/IStreamResolver';
import { AudioStream, AudioStreamType, SourceType, Track } from '../../core/types';
import { StreamResolutionError } from '../../core/errors';

/** Mapeia o tipo de stream retornado pelo play-dl para o nosso enum. */
const STREAM_TYPE_BY_VALUE: Record<string, AudioStreamType> = {
  arbitrary: AudioStreamType.Arbitrary,
  raw: AudioStreamType.Raw,
  opus: AudioStreamType.Opus,
  'ogg/opus': AudioStreamType.OggOpus,
  'webm/opus': AudioStreamType.WebmOpus,
};

/**
 * Resolve o áudio reproduzível de uma faixa usando play-dl.
 *
 * Encapsula a regra de que o Spotify não entrega stream direto: para faixas
 * do Spotify, busca um equivalente no YouTube por "título artista" e usa esse
 * áudio. YouTube e SoundCloud transmitem direto pela URL. Esse detalhe fica
 * isolado aqui, atrás de IStreamResolver.
 */
export class PlayDlStreamResolver implements IStreamResolver {
  async resolve(track: Track): Promise<AudioStream> {
    try {
      const playableUrl = await this.resolvePlayableUrl(track);
      const result = await play.stream(playableUrl, { discordPlayerCompatibility: true });
      return {
        stream: result.stream,
        type: STREAM_TYPE_BY_VALUE[String(result.type)] ?? AudioStreamType.Arbitrary,
      };
    } catch (error) {
      throw new StreamResolutionError(
        `Não foi possível obter o áudio de "${track.title}": ${(error as Error).message}`,
      );
    }
  }

  /** Faixas do Spotify são resolvidas para um equivalente no YouTube. */
  private async resolvePlayableUrl(track: Track): Promise<string> {
    if (track.source !== SourceType.Spotify) {
      return track.url;
    }
    const query = `${track.title} ${track.author}`.trim();
    const results = await play.search(query, {
      source: { youtube: 'video' },
      limit: 1,
    });
    const match = results[0];
    if (!match) {
      throw new StreamResolutionError(
        `Sem equivalente no YouTube para a faixa do Spotify "${track.title}".`,
      );
    }
    return match.url;
  }
}

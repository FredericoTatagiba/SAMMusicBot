import play from 'play-dl';

import { TrackNotFoundError } from '../../core/errors';
import { ISourceProvider } from '../../core/interfaces/ISourceProvider';
import { SourceType, Track } from '../../core/types';

/**
 * Objeto de vídeo do play-dl. Reproduzimos apenas os campos que consumimos,
 * evitando acoplar o domínio à tipagem completa da biblioteca (DIP).
 */
interface YouTubeVideoLike {
  readonly id?: string;
  readonly title?: string;
  readonly url: string;
  readonly durationInSec?: number;
  readonly channel?: { name?: string };
  readonly thumbnails?: ReadonlyArray<{ url: string }>;
}

/** Regex que reconhece apenas URLs do YouTube (não termos de busca). */
const YOUTUBE_URL_PATTERN = /(?:youtube\.com|youtu\.be)/i;

/**
 * Provider de YouTube. Resolve URLs de vídeo, URLs de playlist e buscas
 * textuais (fallback) em faixas do domínio, usando a biblioteca play-dl.
 */
export class YouTubeProvider implements ISourceProvider {
  public readonly source = SourceType.YouTube;

  /**
   * Reconhece somente URLs do YouTube. Buscas em texto puro são tratadas
   * por este provider como fallback no `resolve`, mas não em `supports`,
   * que precisa ser barato e síncrono.
   */
  public supports(query: string): boolean {
    return YOUTUBE_URL_PATTERN.test(query);
  }

  public async resolve(query: string): Promise<Track[]> {
    const kind = play.yt_validate(query);

    if (kind === 'playlist') {
      return this.resolvePlaylist(query);
    }

    if (kind === 'video') {
      return this.resolveVideo(query);
    }

    return this.resolveSearch(query);
  }

  /** Resolve uma URL de playlist em todas as suas faixas. */
  private async resolvePlaylist(query: string): Promise<Track[]> {
    const pl = await play.playlist_info(query, { incomplete: true });
    const videos = await pl.all_videos();
    return videos.map((video) => this.toTrack(video));
  }

  /** Resolve uma URL de vídeo único em uma faixa. */
  private async resolveVideo(query: string): Promise<Track[]> {
    const info = await play.video_info(query);
    const details = info.video_details as YouTubeVideoLike | undefined;

    // Guarda: a URL pode não resolver em algo utilizável.
    if (!details) {
      throw new TrackNotFoundError(query);
    }

    return [this.toTrack(details)];
  }

  /** Resolve um termo de busca na melhor correspondência (1 faixa). */
  private async resolveSearch(query: string): Promise<Track[]> {
    const results = await play.search(query, {
      source: { youtube: 'video' },
      limit: 1,
    });

    if (results.length === 0) {
      throw new TrackNotFoundError(query);
    }

    return [this.toTrack(results[0])];
  }

  /** Mapeia um objeto de vídeo do play-dl para o value object de domínio. */
  private toTrack(video: YouTubeVideoLike): Track {
    return {
      id: video.id ?? '',
      title: video.title ?? 'Desconhecido',
      author: video.channel?.name ?? 'Desconhecido',
      durationMs: (video.durationInSec ?? 0) * 1000,
      url: video.url,
      source: SourceType.YouTube,
      thumbnailUrl: video.thumbnails?.[0]?.url,
    };
  }
}

import { TrackNotFoundError } from '../../core/errors';
import { ISourceProvider } from '../../core/interfaces/ISourceProvider';
import {
  ExecYtDlpMetadataClient,
  YtDlpInfo,
  YtDlpMetadataClient,
} from '../../infrastructure/ytdlp/YtDlpMetadataClient';
import { SourceType, Track } from '../../core/types';

/** Regex que reconhece apenas URLs do SoundCloud (não termos de busca). */
const SOUNDCLOUD_URL_PATTERN = /soundcloud\.com/i;

/** Reconhece sets (playlists) do SoundCloud pelo segmento `/sets/`. */
const SOUNDCLOUD_SET_PATTERN = /\/sets\//i;

/**
 * Provider de SoundCloud. Resolve URLs de faixa e de set (playlist) em faixas
 * do domínio.
 *
 * A extração é delegada a um `YtDlpMetadataClient` injetado (Dependency
 * Inversion). O yt-dlp acessa o SoundCloud sem exigir client id, então não há
 * mais etapa de autenticação como na implementação anterior.
 */
export class SoundCloudProvider implements ISourceProvider {
  public readonly source = SourceType.SoundCloud;

  constructor(
    private readonly client: YtDlpMetadataClient = new ExecYtDlpMetadataClient(),
  ) {}

  /**
   * Reconhece somente URLs do SoundCloud. Mantém-se barato e síncrono,
   * conforme o contrato de `ISourceProvider`.
   */
  public supports(query: string): boolean {
    return SOUNDCLOUD_URL_PATTERN.test(query);
  }

  public async resolve(query: string): Promise<Track[]> {
    if (SOUNDCLOUD_SET_PATTERN.test(query)) {
      return this.resolvePlaylist(query);
    }

    const info = await this.client.extract(query, { noPlaylist: true });

    // Algumas URLs de set não trazem `/sets/`; o payload as revela via entries.
    if (info.entries) {
      return this.mapEntries(query, info.entries);
    }
    if (!info.id && !info.url && !info.webpage_url) {
      throw new TrackNotFoundError(query);
    }
    return [this.toTrack(info)];
  }

  /** Resolve um set em todas as suas faixas. */
  private async resolvePlaylist(query: string): Promise<Track[]> {
    const info = await this.client.extract(query, { flatPlaylist: true });
    return this.mapEntries(query, info.entries ?? []);
  }

  private mapEntries(
    query: string,
    entries: ReadonlyArray<YtDlpInfo>,
  ): Track[] {
    if (entries.length === 0) {
      throw new TrackNotFoundError(query);
    }
    return entries.map((entry) => this.toTrack(entry));
  }

  /** Mapeia metadados do yt-dlp para o value object de domínio. */
  private toTrack(info: YtDlpInfo): Track {
    return {
      id: info.id ?? '',
      title: info.title ?? 'Desconhecido',
      author: info.uploader ?? info.channel ?? 'Desconhecido',
      durationMs: Math.round((info.duration ?? 0) * 1000),
      url: info.webpage_url ?? info.url ?? '',
      source: SourceType.SoundCloud,
      thumbnailUrl: info.thumbnail,
    };
  }
}

import { TrackNotFoundError } from '../../core/errors';
import { ISourceProvider } from '../../core/interfaces/ISourceProvider';
import {
  ExecYtDlpMetadataClient,
  YtDlpInfo,
  YtDlpMetadataClient,
} from '../../infrastructure/ytdlp/YtDlpMetadataClient';
import { SourceType, Track } from '../../core/types';

/** Regex que reconhece apenas URLs do YouTube (não termos de busca). */
const YOUTUBE_URL_PATTERN = /(?:youtube\.com|youtu\.be)/i;

/**
 * Provider de YouTube. Resolve URLs de playlist, URLs de vídeo, URLs de live
 * (`/watch?v=`, `/live/ID`, `@canal/live`) e buscas textuais (fallback) em
 * faixas do domínio.
 *
 * Toda a extração é delegada a um `YtDlpMetadataClient` injetado
 * (Dependency Inversion): em produção usa o yt-dlp; em testes, um fake.
 */
export class YouTubeProvider implements ISourceProvider {
  public readonly source = SourceType.YouTube;

  constructor(
    private readonly client: YtDlpMetadataClient = new ExecYtDlpMetadataClient(),
  ) {}

  /**
   * Reconhece somente URLs do YouTube. Buscas em texto puro são tratadas
   * por este provider como fallback no `resolve`, mas não em `supports`,
   * que precisa ser barato e síncrono. Cobre também os formatos de live
   * (`/live/ID`, `@canal/live`, `/channel/UC.../live`), pois todos casam o
   * domínio e são resolvidos como vídeo único (não têm `list=`).
   */
  public supports(query: string): boolean {
    return YOUTUBE_URL_PATTERN.test(query);
  }

  public async resolve(query: string): Promise<Track[]> {
    if (!this.supports(query)) {
      return this.resolveSearch(query);
    }
    if (this.isPlaylistUrl(query)) {
      return this.resolvePlaylist(query);
    }
    return this.resolveVideo(query);
  }

  /**
   * URL de playlist "pura" (`/playlist?list=`) — sem um vídeo específico.
   * Quando há `v=`, tratamos como vídeo único (comportamento esperado de
   * tocar a faixa apontada, não a playlist inteira).
   */
  private isPlaylistUrl(query: string): boolean {
    return /[?&]list=/.test(query) && !/[?&]v=/.test(query);
  }

  /** Resolve uma URL de playlist em todas as suas faixas. */
  private async resolvePlaylist(query: string): Promise<Track[]> {
    const info = await this.client.extract(query, { flatPlaylist: true });
    return this.mapEntries(query, info.entries ?? []);
  }

  /** Resolve uma URL de vídeo único (ou live) em uma faixa. */
  private async resolveVideo(query: string): Promise<Track[]> {
    const info = await this.client.extract(query, { noPlaylist: true });
    if (!info.id && !info.url && !info.webpage_url) {
      throw new TrackNotFoundError(query);
    }
    return [this.toTrack(info)];
  }

  /** Resolve um termo de busca na melhor correspondência (1 faixa). */
  private async resolveSearch(query: string): Promise<Track[]> {
    const info = await this.client.extract(`ytsearch1:${query}`);
    const first = info.entries?.[0];
    if (!first) {
      throw new TrackNotFoundError(query);
    }
    return [this.toTrack(first)];
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
    const id = info.id ?? '';
    const isLive = this.isLive(info);
    return {
      id,
      title: info.title ?? 'Desconhecido',
      author: info.channel ?? info.uploader ?? 'Desconhecido',
      // Lives não têm fim previsível: normalizamos a duração para 0 para que a
      // UX ("🔴 ao vivo") não dependa de um valor eventualmente reportado.
      durationMs: isLive ? 0 : Math.round((info.duration ?? 0) * 1000),
      url: this.resolveUrl(info, id),
      source: SourceType.YouTube,
      thumbnailUrl: info.thumbnail,
      // Incluído só quando true para não poluir faixas comuns (value object).
      ...(isLive ? { isLive: true } : {}),
    };
  }

  /**
   * Detecta transmissão ao vivo. `is_live` é a fonte primária; `live_status`
   * cobre casos em que o yt-dlp só preenche o status textual ('is_live').
   * 'was_live'/'post_live' NÃO são ao vivo — são VODs de lives encerradas.
   */
  private isLive(info: YtDlpInfo): boolean {
    return info.is_live === true || info.live_status === 'is_live';
  }

  /**
   * Em modo flat, as entradas costumam trazer só o id; reconstruímos a URL
   * canônica do vídeo para que o resolver de stream (yt-dlp) consiga tocá-la.
   */
  private resolveUrl(info: YtDlpInfo, id: string): string {
    if (info.webpage_url) {
      return info.webpage_url;
    }
    if (info.url && /^https?:/i.test(info.url)) {
      return info.url;
    }
    return id ? `https://www.youtube.com/watch?v=${id}` : (info.url ?? '');
  }
}

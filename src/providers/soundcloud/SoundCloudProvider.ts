import play from 'play-dl';

import { TrackNotFoundError } from '../../core/errors';
import { ISourceProvider } from '../../core/interfaces/ISourceProvider';
import { SourceType, Track } from '../../core/types';

/**
 * Objeto de faixa do play-dl (SoundCloudTrack). Reproduzimos apenas os campos
 * que consumimos, evitando acoplar o domínio à tipagem completa da biblioteca
 * (Dependency Inversion Principle).
 */
interface SoundCloudTrackLike {
  readonly id?: number;
  readonly name?: string;
  readonly url: string;
  readonly durationInMs?: number;
  readonly user?: { name?: string };
  readonly thumbnail?: string;
}

/**
 * Resultado do play-dl para SoundCloud. O campo `.type` discrimina a forma do
 * payload: faixa única, playlist ou perfil de usuário.
 */
interface SoundCloudResultLike {
  readonly type: 'track' | 'playlist' | 'user';
  readonly tracks?: ReadonlyArray<SoundCloudTrackLike>;
  /** Algumas playlists expõem este método para completar faixas parciais. */
  readonly fetch?: () => Promise<unknown>;
}

/** Regex que reconhece apenas URLs do SoundCloud (não termos de busca). */
const SOUNDCLOUD_URL_PATTERN = /soundcloud\.com/i;

/**
 * Provider de SoundCloud. Resolve URLs de faixa e de playlist em faixas do
 * domínio, usando a biblioteca play-dl.
 */
export class SoundCloudProvider implements ISourceProvider {
  public readonly source = SourceType.SoundCloud;

  /**
   * O play-dl precisa de um client id gratuito (apenas uma vez) para acessar
   * o SoundCloud. Cacheamos o estado para não reautenticar a cada resolução.
   */
  private authReady = false;

  /**
   * Reconhece somente URLs do SoundCloud. Mantém-se barato e síncrono,
   * conforme o contrato de `ISourceProvider`.
   */
  public supports(query: string): boolean {
    return SOUNDCLOUD_URL_PATTERN.test(query);
  }

  public async resolve(query: string): Promise<Track[]> {
    await this.ensureAuth();

    const result = (await play.soundcloud(query)) as SoundCloudResultLike;

    if (result.type === 'track') {
      return [this.toTrack(result as unknown as SoundCloudTrackLike)];
    }

    if (result.type === 'playlist') {
      return this.resolvePlaylist(result);
    }

    // Tipos não suportados (ex.: perfil de usuário) não geram faixas.
    throw new TrackNotFoundError(query);
  }

  /**
   * Garante a autenticação anônima do play-dl com o SoundCloud. É idempotente:
   * a partir da primeira chamada bem-sucedida, retorna imediatamente.
   */
  private async ensureAuth(): Promise<void> {
    if (this.authReady) {
      return;
    }

    const clientId = await play.getFreeClientID();
    play.setToken({ soundcloud: { client_id: clientId } });
    this.authReady = true;
  }

  /** Resolve uma playlist em todas as suas faixas. */
  private async resolvePlaylist(playlist: SoundCloudResultLike): Promise<Track[]> {
    // Algumas playlists trazem faixas parciais; `fetch()` as completa.
    if (typeof playlist.fetch === 'function') {
      await playlist.fetch();
    }

    const tracks = playlist.tracks ?? [];
    return tracks.map((track) => this.toTrack(track));
  }

  /** Mapeia uma faixa do play-dl para o value object de domínio. */
  private toTrack(track: SoundCloudTrackLike): Track {
    return {
      id: String(track.id ?? ''),
      title: track.name ?? 'Desconhecido',
      author: track.user?.name ?? 'Desconhecido',
      durationMs: track.durationInMs ?? 0,
      url: track.url,
      source: SourceType.SoundCloud,
      thumbnailUrl: track.thumbnail,
    };
  }
}

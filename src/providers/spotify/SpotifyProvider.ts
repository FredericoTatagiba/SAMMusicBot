import { ISourceProvider } from '../../core/interfaces/ISourceProvider';
import { SourceType, Track } from '../../core/types';
import { TrackNotFoundError } from '../../core/errors';

/** Faixa retornada pela extração do Spotify (apenas campos consumidos). */
interface ScrapedTrack {
  readonly name?: string;
  readonly artist?: string;
  readonly duration?: number;
  readonly uri?: string;
}

/** Resultado da extração: preview (capa) + lista de faixas. */
interface ScrapedDetails {
  readonly preview?: { image?: string };
  readonly tracks?: ScrapedTrack[];
}

/**
 * Abstração da extração de dados do Spotify. Injetável para testes
 * (Dependency Inversion), sem depender de rede real.
 */
export interface SpotifyScraper {
  getDetails(url: string): Promise<ScrapedDetails>;
}

/**
 * Fábrica do `spotify-url-info`. O pacote tipa seu default export como uma
 * interface (limitação dos tipos), então usamos `require` com cast para obter
 * a função utilizável em runtime.
 */
type SpotifyUrlInfoFactory = (fetchImpl: typeof fetch) => {
  getDetails(url: string): Promise<ScrapedDetails>;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const spotifyUrlInfo = require('spotify-url-info') as SpotifyUrlInfoFactory;

/**
 * Scraper padrão: lê a página de embed pública do Spotify — funciona sem
 * credenciais e contorna a restrição da Web API oficial para playlists.
 */
function createDefaultScraper(): SpotifyScraper {
  const api = spotifyUrlInfo(fetch);
  return { getDetails: (url: string) => api.getDetails(url) };
}

const SPOTIFY_URL_PATTERN = /open\.spotify\.com|spotify:/i;

/**
 * Provider de Spotify. Resolve faixa, álbum e playlist em faixas do domínio
 * lendo a página de embed pública (sem Web API, sem credenciais).
 *
 * O Spotify não fornece o áudio; entregamos apenas metadados (título/artista),
 * e a reprodução é resolvida por busca no YouTube (ver YtDlpStreamResolver).
 */
export class SpotifyProvider implements ISourceProvider {
  public readonly source = SourceType.Spotify;

  constructor(private readonly scraper: SpotifyScraper = createDefaultScraper()) {}

  /** Reconhece apenas links/URIs do Spotify (barato e síncrono). */
  public supports(query: string): boolean {
    return SPOTIFY_URL_PATTERN.test(query);
  }

  public async resolve(query: string): Promise<Track[]> {
    let details: ScrapedDetails;
    try {
      details = await this.scraper.getDetails(query);
    } catch {
      // Falha de extração (link inválido, indisponível, mudança de layout).
      throw new TrackNotFoundError(query);
    }

    const thumbnail = details.preview?.image;
    const tracks = (details.tracks ?? [])
      .filter((track): track is ScrapedTrack => Boolean(track?.name))
      .map((track) => this.toTrack(track, thumbnail));

    if (tracks.length === 0) {
      throw new TrackNotFoundError(query);
    }
    return tracks;
  }

  /** Mapeia uma faixa extraída para o value object de domínio. */
  private toTrack(track: ScrapedTrack, thumbnail?: string): Track {
    return {
      id: this.extractId(track.uri),
      title: track.name ?? 'Desconhecido',
      author: track.artist || 'Desconhecido',
      durationMs: track.duration ?? 0,
      url: this.toUrl(track.uri),
      source: SourceType.Spotify,
      thumbnailUrl: thumbnail,
    };
  }

  private extractId(uri?: string): string {
    const parts = (uri ?? '').split(':');
    return parts[parts.length - 1] ?? '';
  }

  /** Converte um URI `spotify:track:ID` em URL `https://open.spotify.com/...`. */
  private toUrl(uri?: string): string {
    const match = /spotify:(track|album|playlist|episode):([a-zA-Z0-9]+)/.exec(
      uri ?? '',
    );
    return match ? `https://open.spotify.com/${match[1]}/${match[2]}` : (uri ?? '');
  }
}

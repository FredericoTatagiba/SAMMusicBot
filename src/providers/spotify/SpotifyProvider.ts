import { ConfigurationError, TrackNotFoundError } from '../../core/errors';
import { SpotifyCredentials } from '../../core/interfaces/IConfig';
import { ISourceProvider } from '../../core/interfaces/ISourceProvider';
import { SourceType, Track } from '../../core/types';

/**
 * Assinatura da função de busca HTTP. Injetada no construtor para permitir
 * testes determinísticos sem chamadas de rede reais (Dependency Inversion).
 */
type FetchFn = typeof fetch;

/** Tipos de recurso do Spotify que sabemos resolver. */
type SpotifyResourceType = 'track' | 'album' | 'playlist';

/** Recurso identificado a partir de uma URL/URI do Spotify. */
interface SpotifyResource {
  readonly type: SpotifyResourceType;
  readonly id: string;
}

/**
 * Objeto de faixa da Spotify Web API. Reproduzimos apenas os campos que
 * consumimos, evitando acoplar o domínio à tipagem completa da API.
 */
interface SpotifyTrackObject {
  readonly id?: string;
  readonly name?: string;
  readonly artists?: ReadonlyArray<{ name?: string }>;
  readonly duration_ms?: number;
  readonly external_urls?: { spotify?: string };
  readonly album?: { images?: ReadonlyArray<{ url: string }> };
}

/** Resposta do endpoint de token (Client Credentials). */
interface TokenResponse {
  readonly access_token: string;
}

/** Regex que reconhece links e URIs do Spotify (barato e síncrono). */
const SPOTIFY_URL_PATTERN = /open\.spotify\.com|spotify:/i;

/** Tipos de recurso aceitos, usado para validar o parsing da URL. */
const SUPPORTED_TYPES: ReadonlySet<string> = new Set(['track', 'album', 'playlist']);

/**
 * Provider de Spotify. Resolve links de faixa, álbum e playlist em faixas do
 * domínio consumindo a Spotify Web API diretamente via `fetch`, sem play-dl.
 *
 * Observação: o Spotify não fornece o stream de áudio; este provider entrega
 * apenas metadados. A reprodução é feita por outra fonte (ex.: YouTube).
 */
export class SpotifyProvider implements ISourceProvider {
  public readonly source = SourceType.Spotify;

  constructor(
    private readonly credentials: SpotifyCredentials,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  /** Reconhece apenas links/URIs do Spotify. */
  public supports(query: string): boolean {
    return SPOTIFY_URL_PATTERN.test(query);
  }

  public async resolve(query: string): Promise<Track[]> {
    // Falha cedo: sem credenciais não há como autenticar na API.
    if (!this.credentials.clientId || !this.credentials.clientSecret) {
      throw new ConfigurationError(
        'Spotify não está configurado (defina SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET).',
      );
    }

    const resource = this.parseUrl(query);
    if (!resource) {
      throw new TrackNotFoundError(query);
    }

    const token = await this.requestToken();
    const data = await this.fetchResource(resource, token, query);
    const tracks = this.mapResource(resource.type, data, query);

    if (tracks.length === 0) {
      throw new TrackNotFoundError(query);
    }

    return tracks;
  }

  /**
   * Extrai tipo e id de um link `https://open.spotify.com/{type}/{id}`
   * (com query string e segmento de locale opcionais, ex.: `/intl-pt/`)
   * ou de um URI `spotify:{type}:{id}`. Retorna `null` se não reconhecer.
   */
  private parseUrl(query: string): SpotifyResource | null {
    const uriMatch = /spotify:(track|album|playlist):([a-zA-Z0-9]+)/i.exec(query);
    if (uriMatch) {
      return { type: uriMatch[1].toLowerCase() as SpotifyResourceType, id: uriMatch[2] };
    }

    const urlMatch =
      /open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist)\/([a-zA-Z0-9]+)/i.exec(query);
    if (urlMatch && SUPPORTED_TYPES.has(urlMatch[1].toLowerCase())) {
      return { type: urlMatch[1].toLowerCase() as SpotifyResourceType, id: urlMatch[2] };
    }

    return null;
  }

  /**
   * Obtém um access token via fluxo Client Credentials. Erros 400/401
   * normalmente indicam credenciais inválidas, então viram ConfigurationError.
   */
  private async requestToken(): Promise<string> {
    const basic = Buffer.from(
      `${this.credentials.clientId}:${this.credentials.clientSecret}`,
    ).toString('base64');

    const response = await this.fetchFn('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new ConfigurationError(
        'Falha ao autenticar no Spotify: verifique SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET.',
      );
    }

    const body = (await response.json()) as TokenResponse;
    return body.access_token;
  }

  /** Busca o recurso (track/album/playlist) autenticado com o token. */
  private async fetchResource(
    resource: SpotifyResource,
    token: string,
    query: string,
  ): Promise<unknown> {
    const url = `https://api.spotify.com/v1/${resource.type}s/${resource.id}`;
    const response = await this.fetchFn(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new TrackNotFoundError(query);
    }

    return response.json();
  }

  /** Despacha o mapeamento conforme o tipo de recurso. */
  private mapResource(type: SpotifyResourceType, data: unknown, query: string): Track[] {
    switch (type) {
      case 'track':
        return [this.mapTrackObject(data as SpotifyTrackObject)];
      case 'album':
        return this.mapAlbum(data as AlbumResponse);
      case 'playlist':
        return this.mapPlaylist(data as PlaylistResponse);
      default:
        // Inalcançável: parseUrl só produz tipos suportados. Guarda defensiva.
        throw new TrackNotFoundError(query);
    }
  }

  /**
   * Mapeia as faixas de um álbum. As faixas vêm "simplificadas" (sem imagem
   * própria), então usamos a capa do álbum como thumbnail de todas elas.
   */
  private mapAlbum(album: AlbumResponse): Track[] {
    const albumThumbnail = album.images?.[0]?.url;
    const items = album.tracks?.items ?? [];
    return items
      .filter((item): item is SpotifyTrackObject => Boolean(item?.id))
      .map((item) => this.mapTrackObject(item, albumThumbnail));
  }

  /**
   * Mapeia as faixas de uma playlist. Itens com `track` nulo (faixas locais
   * ou removidas) são descartados; cada faixa traz sua própria imagem de álbum.
   */
  private mapPlaylist(playlist: PlaylistResponse): Track[] {
    const items = playlist.tracks?.items ?? [];
    return items
      .map((item) => item?.track)
      .filter((track): track is SpotifyTrackObject => Boolean(track?.id))
      .map((track) => this.mapTrackObject(track));
  }

  /**
   * Mapeia um objeto de faixa do Spotify para o value object de domínio.
   * Quando informado, `fallbackThumbnail` cobre faixas sem imagem própria.
   */
  private mapTrackObject(track: SpotifyTrackObject, fallbackThumbnail?: string): Track {
    const author = (track.artists ?? [])
      .map((artist) => artist.name)
      .filter((name): name is string => Boolean(name))
      .join(', ');
    return {
      id: track.id ?? '',
      title: track.name ?? 'Desconhecido',
      author: author || 'Desconhecido',
      durationMs: track.duration_ms ?? 0,
      // O áudio do Spotify é resolvido por busca (título + artista), então uma
      // URL ausente não impede a reprodução.
      url: track.external_urls?.spotify ?? '',
      source: SourceType.Spotify,
      thumbnailUrl: track.album?.images?.[0]?.url ?? fallbackThumbnail,
    };
  }
}

/** Resposta do endpoint de álbum (campos opcionais por robustez). */
interface AlbumResponse {
  readonly images?: ReadonlyArray<{ url: string }>;
  readonly tracks?: { items?: ReadonlyArray<SpotifyTrackObject> };
}

/** Resposta do endpoint de playlist (campos opcionais por robustez). */
interface PlaylistResponse {
  readonly tracks?: { items?: ReadonlyArray<{ track: SpotifyTrackObject | null }> };
}

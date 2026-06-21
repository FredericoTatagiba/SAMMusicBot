import { ConfigurationError, TrackNotFoundError } from '../../src/core/errors';
import { SourceType } from '../../src/core/types';
import { SpotifyProvider } from '../../src/providers/spotify/SpotifyProvider';

/**
 * Constrói uma resposta tipo `Response` fake com corpo JSON `body`.
 * Castada para `Response` para satisfazer o TS estrito sob ts-jest.
 */
function fakeResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

/** Credenciais válidas reutilizadas nos testes que chegam à API. */
const VALID_CREDENTIALS = { clientId: 'id', clientSecret: 'secret' };

describe('SpotifyProvider', () => {
  describe('supports()', () => {
    it('retorna true para links e URIs do Spotify', () => {
      const provider = new SpotifyProvider(VALID_CREDENTIALS, jest.fn());

      expect(provider.supports('https://open.spotify.com/track/abc')).toBe(true);
      expect(provider.supports('spotify:track:abc')).toBe(true);
    });

    it('retorna false para outras fontes e texto puro', () => {
      const provider = new SpotifyProvider(VALID_CREDENTIALS, jest.fn());

      expect(provider.supports('https://youtu.be/x')).toBe(false);
      expect(provider.supports('never gonna give you up')).toBe(false);
    });
  });

  describe('resolve()', () => {
    it('resolve uma URL de faixa em uma única Track mapeada corretamente', async () => {
      const fetchFn = jest
        .fn()
        .mockResolvedValueOnce(fakeResponse({ access_token: 'tok' }))
        .mockResolvedValueOnce(
          fakeResponse({
            id: 't1',
            name: 'Minha Faixa',
            artists: [{ name: 'Artista A' }, { name: 'Artista B' }],
            duration_ms: 210000,
            external_urls: { spotify: 'https://open.spotify.com/track/t1' },
            album: { images: [{ url: 'capa.jpg' }] },
          }),
        );
      const provider = new SpotifyProvider(VALID_CREDENTIALS, fetchFn);

      const tracks = await provider.resolve('https://open.spotify.com/track/t1');

      expect(tracks).toEqual([
        {
          id: 't1',
          title: 'Minha Faixa',
          author: 'Artista A, Artista B',
          durationMs: 210000,
          url: 'https://open.spotify.com/track/t1',
          source: SourceType.Spotify,
          thumbnailUrl: 'capa.jpg',
        },
      ]);
    });

    it('resolve uma playlist filtrando itens com track nulo', async () => {
      const validTrack = {
        id: 'p1',
        name: 'Faixa Válida',
        artists: [{ name: 'Solo' }],
        duration_ms: 100000,
        external_urls: { spotify: 'https://open.spotify.com/track/p1' },
        album: { images: [{ url: 'thumb.jpg' }] },
      };
      const fetchFn = jest
        .fn()
        .mockResolvedValueOnce(fakeResponse({ access_token: 'tok' }))
        .mockResolvedValueOnce(
          fakeResponse({ tracks: { items: [{ track: validTrack }, { track: null }] } }),
        );
      const provider = new SpotifyProvider(VALID_CREDENTIALS, fetchFn);

      const tracks = await provider.resolve('https://open.spotify.com/playlist/xyz');

      expect(tracks).toHaveLength(1);
      expect(tracks[0].id).toBe('p1');
      expect(tracks[0].thumbnailUrl).toBe('thumb.jpg');
    });

    it('lança ConfigurationError sem credenciais e não chama o fetch', async () => {
      const fetchFn = jest.fn();
      const provider = new SpotifyProvider({}, fetchFn);

      await expect(provider.resolve('https://open.spotify.com/track/t1')).rejects.toThrow(
        ConfigurationError,
      );
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('lança TrackNotFoundError para uma URL do Spotify sem tipo/id', async () => {
      const provider = new SpotifyProvider(VALID_CREDENTIALS, jest.fn());

      await expect(provider.resolve('https://open.spotify.com/')).rejects.toThrow(
        TrackNotFoundError,
      );
    });
  });
});

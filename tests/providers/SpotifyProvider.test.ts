import { SourceType } from '../../src/core/types';
import {
  SpotifyProvider,
  SpotifyScraper,
} from '../../src/providers/spotify/SpotifyProvider';

function scraperReturning(details: unknown): SpotifyScraper {
  return { getDetails: jest.fn().mockResolvedValue(details) };
}

describe('SpotifyProvider', () => {
  describe('supports()', () => {
    it('retorna true para links e URIs do Spotify', () => {
      const provider = new SpotifyProvider(scraperReturning({}));
      expect(provider.supports('https://open.spotify.com/track/abc')).toBe(true);
      expect(provider.supports('spotify:track:abc')).toBe(true);
    });

    it('retorna false para outras fontes e texto puro', () => {
      const provider = new SpotifyProvider(scraperReturning({}));
      expect(provider.supports('https://youtu.be/x')).toBe(false);
      expect(provider.supports('never gonna give you up')).toBe(false);
    });
  });

  describe('resolve()', () => {
    it('resolve uma faixa mapeada corretamente', async () => {
      const provider = new SpotifyProvider(
        scraperReturning({
          preview: { image: 'capa.jpg' },
          tracks: [
            {
              name: 'Minha Faixa',
              artist: 'Artista A',
              duration: 210000,
              uri: 'spotify:track:t1',
            },
          ],
        }),
      );

      const tracks = await provider.resolve('https://open.spotify.com/track/t1');

      expect(tracks).toEqual([
        {
          id: 't1',
          title: 'Minha Faixa',
          author: 'Artista A',
          durationMs: 210000,
          url: 'https://open.spotify.com/track/t1',
          source: SourceType.Spotify,
          thumbnailUrl: 'capa.jpg',
        },
      ]);
    });

    it('resolve uma playlist com várias faixas', async () => {
      const provider = new SpotifyProvider(
        scraperReturning({
          preview: { image: 'pl.jpg' },
          tracks: [
            { name: 'A', artist: 'X', duration: 1000, uri: 'spotify:track:a' },
            { name: 'B', artist: 'Y', duration: 2000, uri: 'spotify:track:b' },
          ],
        }),
      );

      const tracks = await provider.resolve(
        'https://open.spotify.com/playlist/xyz',
      );

      expect(tracks).toHaveLength(2);
      expect(tracks.map((t) => t.title)).toEqual(['A', 'B']);
      expect(tracks[0]!.thumbnailUrl).toBe('pl.jpg');
    });
  });
});

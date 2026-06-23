import { TrackNotFoundError } from '../../src/core/errors';
import {
  SpotifyProvider,
  SpotifyScraper,
} from '../../src/providers/spotify/SpotifyProvider';

describe('SpotifyProvider (robustez)', () => {
  it('filtra faixas sem nome e aplica defaults nas demais', async () => {
    const scraper: SpotifyScraper = {
      getDetails: jest.fn().mockResolvedValue({
        tracks: [{ uri: 'spotify:track:x' }, { name: 'OK', uri: 'spotify:track:ok' }],
      }),
    };
    const provider = new SpotifyProvider(scraper);

    const tracks = await provider.resolve('https://open.spotify.com/playlist/xyz');

    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.title).toBe('OK');
    expect(tracks[0]!.author).toBe('Desconhecido');
  });

  it('lança TrackNotFoundError quando não há faixas', async () => {
    const scraper: SpotifyScraper = {
      getDetails: jest.fn().mockResolvedValue({ tracks: [] }),
    };
    const provider = new SpotifyProvider(scraper);

    await expect(
      provider.resolve('https://open.spotify.com/playlist/xyz'),
    ).rejects.toBeInstanceOf(TrackNotFoundError);
  });

  it('lança TrackNotFoundError quando a extração falha', async () => {
    const scraper: SpotifyScraper = {
      getDetails: jest.fn().mockRejectedValue(new Error('falha de scraping')),
    };
    const provider = new SpotifyProvider(scraper);

    await expect(
      provider.resolve('https://open.spotify.com/playlist/xyz'),
    ).rejects.toBeInstanceOf(TrackNotFoundError);
  });
});

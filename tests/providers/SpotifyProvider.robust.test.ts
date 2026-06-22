import { SpotifyProvider } from '../../src/providers/spotify/SpotifyProvider';
import { TrackNotFoundError } from '../../src/core/errors';

const creds = { clientId: 'id', clientSecret: 'sec' };

/** fetch falso: primeira chamada = token; demais = recursos, em ordem. */
function makeFetch(...payloads: unknown[]): typeof fetch {
  const fn = jest.fn();
  for (const payload of payloads) {
    fn.mockResolvedValueOnce({
      ok: true,
      json: async () => payload,
    } as unknown as Response);
  }
  return fn as unknown as typeof fetch;
}

describe('SpotifyProvider (robustez contra respostas malformadas)', () => {
  it('álbum sem "tracks" não quebra — vira TrackNotFoundError', async () => {
    const fetchFn = makeFetch({ access_token: 'tok' }, { images: [] });
    const provider = new SpotifyProvider(creds, fetchFn);
    await expect(
      provider.resolve('https://open.spotify.com/album/abc'),
    ).rejects.toBeInstanceOf(TrackNotFoundError);
  });

  it('playlist filtra itens sem faixa válida (null/episódio)', async () => {
    const fetchFn = makeFetch(
      { access_token: 'tok' },
      {
        tracks: {
          items: [
            { track: null },
            { track: { type: 'episode' } },
            {
              track: {
                id: '1',
                name: 'A',
                artists: [{ name: 'X' }],
                duration_ms: 1000,
                external_urls: { spotify: 'u' },
              },
            },
          ],
        },
      },
    );
    const provider = new SpotifyProvider(creds, fetchFn);
    const tracks = await provider.resolve('https://open.spotify.com/playlist/abc');
    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.title).toBe('A');
  });

  it('faixa com campos ausentes usa defaults sem quebrar', async () => {
    const fetchFn = makeFetch({ access_token: 'tok' }, { id: '2' });
    const provider = new SpotifyProvider(creds, fetchFn);
    const tracks = await provider.resolve('https://open.spotify.com/track/abc');
    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.title).toBe('Desconhecido');
    expect(tracks[0]!.author).toBe('Desconhecido');
  });
});

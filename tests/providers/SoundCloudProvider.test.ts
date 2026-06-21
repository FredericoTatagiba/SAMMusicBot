import play from 'play-dl';

import { TrackNotFoundError } from '../../src/core/errors';
import { SourceType } from '../../src/core/types';
import { SoundCloudProvider } from '../../src/providers/soundcloud/SoundCloudProvider';

jest.mock('play-dl');

describe('SoundCloudProvider', () => {
  let provider: SoundCloudProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    // Autenticação anônima mockada: client id fixo e token sem efeito.
    (play.getFreeClientID as jest.Mock).mockResolvedValue('cid');
    (play.setToken as jest.Mock).mockReturnValue(undefined);
    provider = new SoundCloudProvider();
  });

  describe('supports()', () => {
    it('retorna true para URLs do SoundCloud', () => {
      expect(provider.supports('https://soundcloud.com/artist/track')).toBe(true);
    });

    it('retorna false para URLs de outras fontes e texto puro', () => {
      expect(provider.supports('https://youtu.be/x')).toBe(false);
      expect(provider.supports('never gonna give you up')).toBe(false);
    });
  });

  describe('resolve()', () => {
    it('resolve uma URL de faixa em uma única faixa', async () => {
      (play.soundcloud as jest.Mock).mockResolvedValue({
        type: 'track',
        id: 123,
        name: 'Song',
        url: 'https://soundcloud.com/a/song',
        durationInMs: 200000,
        user: { name: 'Artist' },
        thumbnail: 'thumb',
      });

      const tracks = await provider.resolve('https://soundcloud.com/a/song');

      expect(tracks).toEqual([
        {
          id: '123',
          title: 'Song',
          author: 'Artist',
          durationMs: 200000,
          url: 'https://soundcloud.com/a/song',
          source: SourceType.SoundCloud,
          thumbnailUrl: 'thumb',
        },
      ]);
    });

    it('resolve uma URL de playlist em múltiplas faixas', async () => {
      (play.soundcloud as jest.Mock).mockResolvedValue({
        type: 'playlist',
        tracks: [
          { id: 1, name: 'A', url: 'ua', durationInMs: 1000, user: { name: 'UA' }, thumbnail: 'ta' },
          { id: 2, name: 'B', url: 'ub', durationInMs: 2000, user: { name: 'UB' }, thumbnail: 'tb' },
        ],
      });

      const tracks = await provider.resolve('https://soundcloud.com/a/playlist');

      expect(tracks).toHaveLength(2);
      expect(tracks[0].id).toBe('1');
      expect(tracks[1].durationMs).toBe(2000);
      expect(tracks[1].author).toBe('UB');
    });

    it('lança TrackNotFoundError para tipos não suportados (ex.: usuário)', async () => {
      (play.soundcloud as jest.Mock).mockResolvedValue({ type: 'user' });

      await expect(provider.resolve('https://soundcloud.com/a')).rejects.toThrow(
        TrackNotFoundError,
      );
    });

    it('autentica apenas uma vez entre múltiplas resoluções (cache)', async () => {
      (play.soundcloud as jest.Mock).mockResolvedValue({
        type: 'track',
        id: 1,
        name: 'A',
        url: 'ua',
        durationInMs: 1000,
        user: { name: 'UA' },
        thumbnail: 'ta',
      });

      await provider.resolve('https://soundcloud.com/a/song');
      await provider.resolve('https://soundcloud.com/a/song');

      expect(play.getFreeClientID as jest.Mock).toHaveBeenCalledTimes(1);
      expect(play.setToken as jest.Mock).toHaveBeenCalledTimes(1);
    });
  });
});

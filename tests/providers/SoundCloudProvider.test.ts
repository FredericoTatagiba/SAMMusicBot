import { TrackNotFoundError } from '../../src/core/errors';
import { SourceType } from '../../src/core/types';
import {
  YtDlpInfo,
  YtDlpMetadataClient,
} from '../../src/infrastructure/ytdlp/YtDlpMetadataClient';
import { SoundCloudProvider } from '../../src/providers/soundcloud/SoundCloudProvider';

describe('SoundCloudProvider', () => {
  let client: { extract: jest.Mock<Promise<YtDlpInfo>, [string, object?]> };
  let provider: SoundCloudProvider;

  beforeEach(() => {
    client = { extract: jest.fn() };
    provider = new SoundCloudProvider(client as unknown as YtDlpMetadataClient);
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
    it('resolve uma URL de faixa em uma única faixa (com no-playlist)', async () => {
      client.extract.mockResolvedValue({
        id: '123',
        title: 'Song',
        uploader: 'Artist',
        duration: 200,
        webpage_url: 'https://soundcloud.com/a/song',
        thumbnail: 'thumb',
      });

      const tracks = await provider.resolve('https://soundcloud.com/a/song');

      expect(client.extract).toHaveBeenCalledWith('https://soundcloud.com/a/song', {
        noPlaylist: true,
      });
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

    it('resolve uma URL de set (/sets/) em múltiplas faixas (modo flat)', async () => {
      client.extract.mockResolvedValue({
        _type: 'playlist',
        entries: [
          {
            id: '1',
            title: 'A',
            duration: 1,
            uploader: 'UA',
            webpage_url: 'https://soundcloud.com/a/1',
          },
          {
            id: '2',
            title: 'B',
            duration: 2,
            uploader: 'UB',
            webpage_url: 'https://soundcloud.com/a/2',
          },
        ],
      });

      const tracks = await provider.resolve('https://soundcloud.com/a/sets/mix');

      expect(client.extract).toHaveBeenCalledWith('https://soundcloud.com/a/sets/mix', {
        flatPlaylist: true,
      });
      expect(tracks).toHaveLength(2);
      expect(tracks[0].id).toBe('1');
      expect(tracks[1].durationMs).toBe(2000);
      expect(tracks[1].author).toBe('UB');
    });

    it('resolve playlist detectada pelo payload mesmo sem /sets/ na URL', async () => {
      client.extract.mockResolvedValue({
        entries: [
          { id: '7', title: 'C', duration: 3, uploader: 'UC', webpage_url: 'u7' },
        ],
      });

      const tracks = await provider.resolve('https://soundcloud.com/a/algo');

      expect(tracks).toHaveLength(1);
      expect(tracks[0].id).toBe('7');
    });

    it('lança TrackNotFoundError quando nada utilizável é retornado', async () => {
      client.extract.mockResolvedValue({});

      await expect(provider.resolve('https://soundcloud.com/a')).rejects.toThrow(
        TrackNotFoundError,
      );
    });
  });
});

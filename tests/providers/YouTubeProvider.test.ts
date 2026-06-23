import { TrackNotFoundError } from '../../src/core/errors';
import { SourceType } from '../../src/core/types';
import {
  YtDlpInfo,
  YtDlpMetadataClient,
} from '../../src/infrastructure/ytdlp/YtDlpMetadataClient';
import { YouTubeProvider } from '../../src/providers/youtube/YouTubeProvider';

describe('YouTubeProvider', () => {
  let client: { extract: jest.Mock<Promise<YtDlpInfo>, [string, object?]> };
  let provider: YouTubeProvider;

  beforeEach(() => {
    client = { extract: jest.fn() };
    provider = new YouTubeProvider(client as unknown as YtDlpMetadataClient);
  });

  describe('supports()', () => {
    it('retorna true para URLs do YouTube', () => {
      expect(provider.supports('https://www.youtube.com/watch?v=abc')).toBe(true);
      expect(provider.supports('https://youtu.be/abc')).toBe(true);
    });

    it('retorna false para URLs de outras fontes e texto puro', () => {
      expect(provider.supports('https://open.spotify.com/track/x')).toBe(false);
      expect(provider.supports('never gonna give you up')).toBe(false);
    });
  });

  describe('resolve()', () => {
    it('resolve uma URL de vídeo em uma única faixa (com no-playlist)', async () => {
      client.extract.mockResolvedValue({
        id: 'v1',
        title: 'T',
        webpage_url: 'https://www.youtube.com/watch?v=v1',
        duration: 200,
        channel: 'C',
        thumbnail: 'thumb',
      });

      const tracks = await provider.resolve('https://youtu.be/v1');

      expect(client.extract).toHaveBeenCalledWith('https://youtu.be/v1', {
        noPlaylist: true,
      });
      expect(tracks).toEqual([
        {
          id: 'v1',
          title: 'T',
          author: 'C',
          durationMs: 200000,
          url: 'https://www.youtube.com/watch?v=v1',
          source: SourceType.YouTube,
          thumbnailUrl: 'thumb',
        },
      ]);
    });

    it('trata watch?v=...&list=... como vídeo único, não como playlist', async () => {
      client.extract.mockResolvedValue({
        id: 'v9',
        title: 'X',
        webpage_url: 'https://www.youtube.com/watch?v=v9',
        duration: 1,
        channel: 'C',
      });

      await provider.resolve('https://www.youtube.com/watch?v=v9&list=PL123');

      expect(client.extract).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=v9&list=PL123',
        { noPlaylist: true },
      );
    });

    it('resolve uma busca textual na melhor correspondência', async () => {
      client.extract.mockResolvedValue({
        entries: [{ id: 'v2', title: 'T2', duration: 0, channel: 'C2' }],
      });

      const tracks = await provider.resolve('algum termo de busca');

      expect(client.extract).toHaveBeenCalledWith('ytsearch1:algum termo de busca');
      expect(tracks).toEqual([
        {
          id: 'v2',
          title: 'T2',
          author: 'C2',
          durationMs: 0,
          url: 'https://www.youtube.com/watch?v=v2',
          source: SourceType.YouTube,
          thumbnailUrl: undefined,
        },
      ]);
    });

    it('lança TrackNotFoundError quando a busca não retorna resultados', async () => {
      client.extract.mockResolvedValue({ entries: [] });

      await expect(provider.resolve('inexistente')).rejects.toThrow(TrackNotFoundError);
    });

    it('resolve uma URL de playlist em múltiplas faixas (modo flat)', async () => {
      client.extract.mockResolvedValue({
        _type: 'playlist',
        entries: [
          { id: 'a', title: 'A', duration: 10, channel: 'CA' },
          { id: 'b', title: 'B', duration: 20, uploader: 'CB' },
        ],
      });

      const tracks = await provider.resolve(
        'https://youtube.com/playlist?list=PL-abc&si=xyz',
      );

      expect(client.extract).toHaveBeenCalledWith(
        'https://youtube.com/playlist?list=PL-abc&si=xyz',
        { flatPlaylist: true },
      );
      expect(tracks).toHaveLength(2);
      expect(tracks[0].id).toBe('a');
      expect(tracks[0].url).toBe('https://www.youtube.com/watch?v=a');
      expect(tracks[1].durationMs).toBe(20000);
      expect(tracks[1].author).toBe('CB');
    });

    it('lança TrackNotFoundError quando a playlist vem vazia', async () => {
      client.extract.mockResolvedValue({ _type: 'playlist', entries: [] });

      await expect(
        provider.resolve('https://youtube.com/playlist?list=PLempty'),
      ).rejects.toThrow(TrackNotFoundError);
    });
  });
});

import play from 'play-dl';

import { TrackNotFoundError } from '../../src/core/errors';
import { SourceType } from '../../src/core/types';
import { YouTubeProvider } from '../../src/providers/youtube/YouTubeProvider';

jest.mock('play-dl');

const mockedPlay = play as unknown as {
  yt_validate: jest.Mock;
  video_info: jest.Mock;
  playlist_info: jest.Mock;
  search: jest.Mock;
};

describe('YouTubeProvider', () => {
  let provider: YouTubeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new YouTubeProvider();
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
    it('resolve uma URL de vídeo em uma única faixa', async () => {
      mockedPlay.yt_validate.mockReturnValue('video');
      mockedPlay.video_info.mockResolvedValue({
        video_details: {
          id: 'v1',
          title: 'T',
          url: 'u',
          durationInSec: 200,
          channel: { name: 'C' },
          thumbnails: [{ url: 'thumb' }],
        },
      });

      const tracks = await provider.resolve('https://youtu.be/v1');

      expect(tracks).toEqual([
        {
          id: 'v1',
          title: 'T',
          author: 'C',
          durationMs: 200000,
          url: 'u',
          source: SourceType.YouTube,
          thumbnailUrl: 'thumb',
        },
      ]);
    });

    it('resolve uma busca textual na melhor correspondência', async () => {
      mockedPlay.yt_validate.mockReturnValue('search');
      mockedPlay.search.mockResolvedValue([
        {
          id: 'v2',
          title: 'T2',
          url: 'u2',
          durationInSec: 0,
          channel: { name: 'C2' },
          thumbnails: [],
        },
      ]);

      const tracks = await provider.resolve('algum termo de busca');

      expect(tracks).toEqual([
        {
          id: 'v2',
          title: 'T2',
          author: 'C2',
          durationMs: 0,
          url: 'u2',
          source: SourceType.YouTube,
          thumbnailUrl: undefined,
        },
      ]);
    });

    it('lança TrackNotFoundError quando a busca não retorna resultados', async () => {
      mockedPlay.yt_validate.mockReturnValue('search');
      mockedPlay.search.mockResolvedValue([]);

      await expect(provider.resolve('inexistente')).rejects.toThrow(TrackNotFoundError);
    });

    it('resolve uma URL de playlist em múltiplas faixas', async () => {
      mockedPlay.yt_validate.mockReturnValue('playlist');
      mockedPlay.playlist_info.mockResolvedValue({
        all_videos: jest.fn().mockResolvedValue([
          {
            id: 'a',
            title: 'A',
            url: 'ua',
            durationInSec: 10,
            channel: { name: 'CA' },
            thumbnails: [],
          },
          {
            id: 'b',
            title: 'B',
            url: 'ub',
            durationInSec: 20,
            channel: { name: 'CB' },
            thumbnails: [],
          },
        ]),
      });

      const tracks = await provider.resolve('https://www.youtube.com/playlist?list=x');

      expect(tracks).toHaveLength(2);
      expect(tracks[0].id).toBe('a');
      expect(tracks[1].durationMs).toBe(20000);
    });
  });
});

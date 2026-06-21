import { SearchService } from '../../src/services/SearchService';
import { ISourceProvider } from '../../src/core/interfaces/ISourceProvider';
import { SourceType, Track } from '../../src/core/types';
import { TrackNotFoundError } from '../../src/core/errors';
import { NullLogger, makeTrack } from '../helpers/fakes';

function fakeProvider(
  source: SourceType,
  supports: (q: string) => boolean,
  tracks: Track[] = [makeTrack({ source })],
): ISourceProvider {
  return {
    source,
    supports,
    resolve: jest.fn().mockResolvedValue(tracks),
  };
}

describe('SearchService', () => {
  it('delega ao provider cujo supports() casa com a entrada', async () => {
    const spotify = fakeProvider(SourceType.Spotify, (q) => q.includes('spotify'));
    const youtube = fakeProvider(SourceType.YouTube, () => false);
    const service = new SearchService([youtube, spotify], youtube, new NullLogger());

    const result = await service.search('https://open.spotify.com/track/x');

    expect(result[0]!.source).toBe(SourceType.Spotify);
    expect(spotify.resolve).toHaveBeenCalled();
    expect(youtube.resolve).not.toHaveBeenCalled();
  });

  it('usa o fallback quando nenhum provider reconhece a entrada', async () => {
    const youtube = fakeProvider(SourceType.YouTube, () => false);
    const soundcloud = fakeProvider(SourceType.SoundCloud, () => false);
    const service = new SearchService([soundcloud], youtube, new NullLogger());

    const result = await service.search('uma busca textual qualquer');

    expect(result[0]!.source).toBe(SourceType.YouTube);
    expect(youtube.resolve).toHaveBeenCalledWith('uma busca textual qualquer');
  });

  it('lança TrackNotFoundError para consulta vazia', async () => {
    const youtube = fakeProvider(SourceType.YouTube, () => true);
    const service = new SearchService([youtube], youtube, new NullLogger());
    await expect(service.search('   ')).rejects.toThrow(TrackNotFoundError);
  });

  it('lança TrackNotFoundError quando o provider devolve vazio', async () => {
    const youtube = fakeProvider(SourceType.YouTube, () => true, []);
    const service = new SearchService([youtube], youtube, new NullLogger());
    await expect(service.search('algo')).rejects.toThrow(TrackNotFoundError);
  });

  it('rejeita construção sem providers', () => {
    const youtube = fakeProvider(SourceType.YouTube, () => true);
    expect(() => new SearchService([], youtube, new NullLogger())).toThrow();
  });
});

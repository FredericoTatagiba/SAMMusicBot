import youtubedl from 'youtube-dl-exec';
import { ExecYtDlpMetadataClient } from '../../src/infrastructure/ytdlp/YtDlpMetadataClient';

jest.mock('youtube-dl-exec');

const mockedYoutubedl = youtubedl as unknown as jest.Mock;

describe('ExecYtDlpMetadataClient', () => {
  let client: ExecYtDlpMetadataClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedYoutubedl.mockResolvedValue({ id: 'x', title: 'T' });
    client = new ExecYtDlpMetadataClient();
  });

  it('sempre pede JSON único, sem ruído de logs', async () => {
    await client.extract('https://youtu.be/x');

    const [target, flags] = mockedYoutubedl.mock.calls[0];
    expect(target).toBe('https://youtu.be/x');
    expect(flags).toMatchObject({ dumpSingleJson: true, noWarnings: true, quiet: true });
  });

  it('NUNCA passa flags booleanas como false (evita --no-no-playlist)', async () => {
    await client.extract('https://youtu.be/x');

    const flags = mockedYoutubedl.mock.calls[0][1];
    expect(flags).not.toHaveProperty('noPlaylist');
    expect(flags).not.toHaveProperty('flatPlaylist');
  });

  it('inclui flatPlaylist apenas quando solicitado', async () => {
    await client.extract('url', { flatPlaylist: true });

    expect(mockedYoutubedl.mock.calls[0][1]).toMatchObject({ flatPlaylist: true });
    expect(mockedYoutubedl.mock.calls[0][1]).not.toHaveProperty('noPlaylist');
  });

  it('inclui noPlaylist apenas quando solicitado', async () => {
    await client.extract('url', { noPlaylist: true });

    expect(mockedYoutubedl.mock.calls[0][1]).toMatchObject({ noPlaylist: true });
    expect(mockedYoutubedl.mock.calls[0][1]).not.toHaveProperty('flatPlaylist');
  });
});

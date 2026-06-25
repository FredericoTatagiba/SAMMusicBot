import { EventEmitter } from 'events';
import { Readable } from 'stream';
import youtubedl from 'youtube-dl-exec';
import { YtDlpStreamResolver } from '../../src/infrastructure/streaming/YtDlpStreamResolver';
import { AudioStreamType, SourceType, Track } from '../../src/core/types';
import { ILogger } from '../../src/core/interfaces/ILogger';

jest.mock('youtube-dl-exec', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { exec: jest.fn() }),
}));

const mockedExec = (youtubedl as unknown as { exec: jest.Mock }).exec;

function spyLogger(): ILogger {
  const logger: ILogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => logger),
  };
  return logger;
}

interface FakeSub {
  sub: Promise<unknown> & {
    stdout: Readable | null;
    stderr: EventEmitter;
    kill: jest.Mock;
    killed: boolean;
  };
  rejectProcess: (error: Error) => void;
  stderr: EventEmitter;
}

function makeSub(opts: { noStdout?: boolean } = {}): FakeSub {
  let rejectProcess!: (error: Error) => void;
  const promise = new Promise((_, reject) => {
    rejectProcess = reject;
  });
  const stderr = new EventEmitter();
  const sub = Object.assign(promise, {
    stdout: opts.noStdout ? null : new Readable({ read() {} }),
    stderr,
    kill: jest.fn(),
    killed: false,
  });
  return { sub: sub as FakeSub['sub'], rejectProcess, stderr };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

const ytTrack: Track = {
  id: 'v1',
  title: 'T',
  author: 'A',
  durationMs: 1000,
  url: 'https://youtu.be/v1',
  source: SourceType.YouTube,
};

describe('YtDlpStreamResolver', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna o stdout do yt-dlp como stream Arbitrary', async () => {
    const { sub } = makeSub();
    mockedExec.mockReturnValue(sub);

    const result = await new YtDlpStreamResolver(spyLogger()).resolve(ytTrack);

    expect(result.type).toBe(AudioStreamType.Arbitrary);
    expect(result.stream).toBe(sub.stdout);
    expect(mockedExec).toHaveBeenCalledWith(
      'https://youtu.be/v1',
      expect.objectContaining({ output: '-', noPlaylist: true }),
      expect.objectContaining({ windowsHide: true }),
    );
  });

  it('faixa do Spotify vira busca no YouTube (ytsearch1)', async () => {
    const { sub } = makeSub();
    mockedExec.mockReturnValue(sub);

    await new YtDlpStreamResolver(spyLogger()).resolve({
      ...ytTrack,
      title: 'Song',
      author: 'Artist',
      url: '',
      source: SourceType.Spotify,
    });

    expect(mockedExec).toHaveBeenCalledWith(
      'ytsearch1:Song Artist',
      expect.anything(),
      expect.anything(),
    );
  });

  it('lança StreamResolutionError quando não há stdout', async () => {
    const { sub } = makeSub({ noStdout: true });
    mockedExec.mockReturnValue(sub);

    await expect(
      new YtDlpStreamResolver(spyLogger()).resolve(ytTrack),
    ).rejects.toThrow(/Não foi possível obter o áudio/);
  });

  it('loga o stderr do yt-dlp quando o processo falha', async () => {
    const { sub, rejectProcess, stderr } = makeSub();
    mockedExec.mockReturnValue(sub);
    const logger = spyLogger();

    await new YtDlpStreamResolver(logger).resolve(ytTrack);
    stderr.emit('data', Buffer.from('ERROR: Video unavailable'));
    rejectProcess(new Error('exit code 1'));
    await flush();

    expect(logger.warn).toHaveBeenCalledWith(
      'yt-dlp encerrou com erro ao transmitir áudio',
      expect.objectContaining({
        error: 'exit code 1',
        stderr: expect.stringContaining('Video unavailable'),
      }),
    );
  });
});

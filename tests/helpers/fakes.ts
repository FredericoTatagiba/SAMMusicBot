import { IAudioPlayer, IVoiceConnector, VoiceChannelRef } from '../../src/core/interfaces/IAudioPlayer';
import { IStreamResolver } from '../../src/core/interfaces/IStreamResolver';
import { ILogger } from '../../src/core/interfaces/ILogger';
import { AudioStream, AudioStreamType, SourceType, Track } from '../../src/core/types';

/** Logger silencioso para os testes. */
export class NullLogger implements ILogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  child(): ILogger {
    return this;
  }
}

/** Player fake que expõe ganchos para simular fim de faixa e erros. */
export class FakeAudioPlayer implements IAudioPlayer {
  playCount = 0;
  destroyed = false;
  lastAudio: AudioStream | null = null;
  private idleListener: (() => void) | null = null;
  private errorListener: ((error: Error) => void) | null = null;
  private paused = false;

  play(audio: AudioStream): void {
    this.playCount += 1;
    this.lastAudio = audio;
    this.paused = false;
  }
  stop(): void {
    this.emitIdle();
  }
  pause(): boolean {
    if (this.paused) return false;
    this.paused = true;
    return true;
  }
  unpause(): boolean {
    if (!this.paused) return false;
    this.paused = false;
    return true;
  }
  setVolume(): void {}
  onIdle(listener: () => void): void {
    this.idleListener = listener;
  }
  onError(listener: (error: Error) => void): void {
    this.errorListener = listener;
  }
  destroy(): void {
    this.destroyed = true;
  }
  /** Simula o término natural da faixa atual. */
  emitIdle(): void {
    this.idleListener?.();
  }
  /** Simula um erro de reprodução. */
  emitError(error: Error): void {
    this.errorListener?.(error);
  }
}

/** Connector fake que sempre devolve o mesmo player (inspecionável). */
export class FakeVoiceConnector implements IVoiceConnector {
  connectCount = 0;
  lastRef: VoiceChannelRef | null = null;
  constructor(public readonly player: FakeAudioPlayer = new FakeAudioPlayer()) {}
  connect(ref: VoiceChannelRef): IAudioPlayer {
    this.connectCount += 1;
    this.lastRef = ref;
    return this.player;
  }
}

/** Stream resolver fake; pode ser configurado para falhar. */
export class FakeStreamResolver implements IStreamResolver {
  constructor(private readonly shouldFail: (track: Track) => boolean = () => false) {}
  resolve(track: Track): Promise<AudioStream> {
    if (this.shouldFail(track)) {
      return Promise.reject(new Error(`falha simulada: ${track.title}`));
    }
    return Promise.resolve({
      stream: { on: () => {} } as unknown as NodeJS.ReadableStream,
      type: AudioStreamType.Arbitrary,
    });
  }
}

/** Cria uma Track de teste com sobrescritas opcionais. */
export function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'id-1',
    title: 'Faixa de Teste',
    author: 'Artista',
    durationMs: 180_000,
    url: 'https://example.com/track',
    source: SourceType.YouTube,
    ...overrides,
  };
}

import { IAudioPlayer, IVoiceConnector } from '../core/interfaces/IAudioPlayer';
import { IStreamResolver } from '../core/interfaces/IStreamResolver';
import { ILogger } from '../core/interfaces/ILogger';
import { LoopMode, Track } from '../core/types';
import { MusicQueue } from './MusicQueue';

export interface EnqueueResult {
  /** true se a reprodução começou imediatamente (fila estava ociosa). */
  readonly startedPlayback: boolean;
  /** quantidade de faixas adicionadas. */
  readonly added: number;
}

export interface QueueSnapshot {
  readonly current: Track | null;
  readonly upcoming: readonly Track[];
  readonly loopMode: LoopMode;
}

/**
 * Orquestra a reprodução de áudio de UM servidor.
 *
 * Coordena fila (MusicQueue), conexão de voz (IVoiceConnector → IAudioPlayer)
 * e resolução de stream (IStreamResolver). Toda a infraestrutura é injetada
 * por interfaces (Dependency Inversion), então esta classe é testável com
 * fakes — sem Discord nem rede.
 */
export class GuildMusicService {
  private player: IAudioPlayer | null = null;
  private isPlaying = false;
  private advancing = false;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly guildId: string,
    private readonly queue: MusicQueue,
    private readonly connector: IVoiceConnector,
    private readonly streamResolver: IStreamResolver,
    private readonly logger: ILogger,
    private readonly idleDisconnectMs: number,
    private readonly onDispose: (guildId: string) => void,
  ) {}

  /** Adiciona faixas à fila e inicia a reprodução se estiver ociosa. */
  async enqueue(
    tracks: readonly Track[],
    voiceChannelId: string,
    requestedById: string,
  ): Promise<EnqueueResult> {
    tracks.forEach((track) => {
      track.requestedById = requestedById;
    });
    this.queue.addMany(tracks);
    this.ensureConnected(voiceChannelId);

    if (!this.isPlaying) {
      await this.playNext();
      return { startedPlayback: true, added: tracks.length };
    }
    return { startedPlayback: false, added: tracks.length };
  }

  /** Pula a faixa atual. Retorna false se nada estava tocando. */
  skip(): boolean {
    if (!this.isPlaying || !this.player) {
      return false;
    }
    // stop() dispara o evento idle, que avança para a próxima faixa.
    this.player.stop();
    return true;
  }

  /** Para tudo, limpa a fila e desconecta. */
  stop(): void {
    this.queue.clear();
    this.teardown();
  }

  pause(): boolean {
    return this.player?.pause() ?? false;
  }

  resume(): boolean {
    return this.player?.unpause() ?? false;
  }

  setLoopMode(mode: LoopMode): void {
    this.queue.setLoopMode(mode);
  }

  shuffle(): void {
    this.queue.shuffle();
  }

  snapshot(): QueueSnapshot {
    return {
      current: this.queue.getCurrent(),
      upcoming: this.queue.getUpcoming(),
      loopMode: this.queue.getLoopMode(),
    };
  }

  private ensureConnected(voiceChannelId: string): void {
    if (this.player) {
      return;
    }
    this.player = this.connector.connect({
      guildId: this.guildId,
      channelId: voiceChannelId,
    });
    this.player.onIdle(() => {
      void this.handleTrackEnd();
    });
    this.player.onError((error) => {
      this.logger.error('Erro no player de áudio', { error: error.message });
      void this.handleTrackEnd();
    });
  }

  private async handleTrackEnd(): Promise<void> {
    // Guarda contra avanço duplo: ao falhar, o player pode emitir 'error' e
    // 'idle' quase juntos; sem isto, pularíamos duas faixas de uma vez.
    if (this.advancing) {
      return;
    }
    this.advancing = true;
    this.isPlaying = false;
    try {
      await this.playNext();
    } finally {
      this.advancing = false;
    }
  }

  private async playNext(): Promise<void> {
    const track = this.queue.next();
    if (!track || !this.player) {
      this.isPlaying = false;
      this.scheduleIdleDisconnect();
      return;
    }
    this.cancelIdleDisconnect();
    try {
      const audio = await this.streamResolver.resolve(track);
      this.player.play(audio);
      this.isPlaying = true;
      this.logger.info('Reproduzindo faixa', {
        title: track.title,
        source: track.source,
      });
    } catch (error) {
      this.logger.error('Falha ao resolver stream; pulando faixa', {
        title: track.title,
        error: (error as Error).message,
      });
      await this.playNext();
    }
  }

  private scheduleIdleDisconnect(): void {
    this.cancelIdleDisconnect();
    this.idleTimer = setTimeout(() => {
      this.logger.info('Desconectando por inatividade');
      this.teardown();
    }, this.idleDisconnectMs);
    // Não impede o processo de encerrar enquanto aguarda.
    this.idleTimer.unref?.();
  }

  private cancelIdleDisconnect(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private teardown(): void {
    this.cancelIdleDisconnect();
    this.isPlaying = false;
    this.player?.destroy();
    this.player = null;
    this.onDispose(this.guildId);
  }
}

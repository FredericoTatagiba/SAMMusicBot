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
  private disposed = false;
  private idleTimer: NodeJS.Timeout | null = null;
  // Serializa as transições de reprodução. Sem isto, um `enqueue` e o fim de
  // uma faixa (idle/error) podiam correr em paralelo nos gaps de `await`,
  // duplicando avanços ou deixando uma conexão órfã fora do QueueManager.
  private opChain: Promise<unknown> = Promise.resolve();

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
    // Cancela QUALQUER desconexão por ociosidade agendada antes de qualquer
    // `await`. Roda na mesma pilha síncrona da chamada, então vence a corrida
    // contra o timer de idle (microtasks/sync executam antes do setTimeout).
    this.cancelIdleDisconnect();
    return this.runExclusive(async () => {
      this.cancelIdleDisconnect();
      tracks.forEach((track) => {
        track.requestedById = requestedById;
      });
      this.queue.addMany(tracks);
      this.ensureConnected(voiceChannelId);

      if (!this.isPlaying) {
        await this.playNext();
        return { startedPlayback: this.isPlaying, added: tracks.length };
      }
      return { startedPlayback: false, added: tracks.length };
    });
  }

  /** Pula a faixa atual. Retorna false se não há faixa atual para pular. */
  skip(): boolean {
    if (!this.player || this.queue.getCurrent() === null) {
      return false;
    }
    // Interrompe o áudio atual e avança de forma determinística. Não dá para
    // depender apenas do 'idle' que o stop dispara: se o player já estiver
    // ocioso (janela entre faixas), o stop vira no-op e o skip se perdia. O
    // guard `advancing` garante um único avanço mesmo quando o 'idle' chega.
    this.player.stop();
    this.advanceToNext();
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
      this.advanceToNext();
    });
    this.player.onError((error) => {
      this.logger.error('Erro no player de áudio', { error: error.message });
      this.advanceToNext();
    });
    this.player.onDisconnect(() => {
      this.handleDisconnect();
    });
  }

  /**
   * Avança para a próxima faixa após o fim (idle), um erro de reprodução ou um
   * skip. `advancing` é marcado de forma SÍNCRONA para descartar avanços
   * duplicados — o par 'error'+'idle' de uma mesma falha, ou o 'idle' que o
   * próprio skip provoca ao parar o player. O avanço em si entra na fila
   * serial (`runExclusive`), nunca correndo em paralelo com um `enqueue`.
   */
  private advanceToNext(): void {
    if (this.disposed || this.advancing) {
      return;
    }
    this.advancing = true;
    this.isPlaying = false;
    void this.runExclusive(async () => {
      try {
        await this.playNext();
      } finally {
        this.advancing = false;
      }
    });
  }

  /**
   * Reage ao encerramento definitivo da conexão de voz (queda sem retorno,
   * kick do bot). Sem isto, o serviço permanecia registrado no QueueManager
   * com um player morto: `ensureConnected` via `this.player` != null e nunca
   * reconectava, então o bot só voltava sendo removido e readicionado. O
   * teardown o remove do mapa; o próximo comando cria um serviço novo.
   */
  private handleDisconnect(): void {
    if (this.disposed) {
      return;
    }
    this.logger.warn('Conexão de voz encerrada; liberando o serviço');
    this.teardown();
  }

  /**
   * Encadeia operações de reprodução numa fila serial. Garante que enqueue,
   * avanço de faixa e suas resoluções de stream nunca se intercalem.
   */
  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.opChain.then(operation);
    // Mantém a cadeia viva mesmo que uma operação rejeite.
    this.opChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async playNext(): Promise<void> {
    if (this.disposed) {
      return;
    }
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
    if (this.disposed) {
      return;
    }
    this.cancelIdleDisconnect();
    this.idleTimer = setTimeout(() => {
      // Reentrância: só desconecta se continuar ocioso. Um enqueue posterior
      // cancela o timer, mas guardamos contra o callback já enfileirado.
      if (this.disposed || this.isPlaying) {
        return;
      }
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
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.cancelIdleDisconnect();
    this.isPlaying = false;
    this.player?.destroy();
    this.player = null;
    this.onDispose(this.guildId);
  }
}

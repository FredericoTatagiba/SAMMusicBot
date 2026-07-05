import { IAudioPlayer, IVoiceConnector } from '../core/interfaces/IAudioPlayer';
import { ILogger } from '../core/interfaces/ILogger';
import { IRadioStreamResolver } from './IRadioStreamResolver';
import { RadioStation } from './types';

/** Janela mínima entre reinícios automáticos do stream (ms). */
const RESTART_WINDOW_MS = 5000;

/**
 * Reprodução de rádio de UM servidor. Diferente do music service, não há fila
 * nem "avançar faixa": é um stream contínuo. Se o stream cair (idle), tenta
 * reabrir uma vez dentro da janela; caindo de novo logo em seguida, encerra.
 *
 * Reaproveita a camada de voz (IVoiceConnector → IAudioPlayer) por injeção.
 */
export class RadioSession {
  private player: IAudioPlayer | null = null;
  private current: RadioStation | null = null;
  private disposed = false;
  private lastRestart = 0;

  constructor(
    private readonly guildId: string,
    private readonly connector: IVoiceConnector,
    private readonly resolver: IRadioStreamResolver,
    private readonly logger: ILogger,
    private readonly onDispose: (guildId: string) => void,
  ) {}

  /** Estação tocando no momento, ou null. */
  get station(): RadioStation | null {
    return this.current;
  }

  /** Conecta (se preciso) e passa a tocar a estação informada. */
  async play(voiceChannelId: string, station: RadioStation): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.ensureConnected(voiceChannelId);
    const audio = await this.resolver.resolve(station.channelId);
    this.player?.play(audio);
    this.current = station;
    this.logger.info('Rádio: tocando estação', {
      title: station.title,
      channelId: station.channelId,
    });
  }

  /** Para a rádio e libera a conexão de voz. */
  stop(): void {
    this.teardown();
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
      void this.handleStreamEnded();
    });
    this.player.onError((error) => {
      this.logger.warn('Rádio: erro no player', { error: error.message });
    });
    this.player.onDisconnect(() => {
      this.teardown();
    });
  }

  /**
   * Stream de rádio não termina sozinho: um idle significa que a fonte caiu.
   * Tenta reabrir uma vez; se cair de novo dentro da janela, desiste.
   */
  private async handleStreamEnded(): Promise<void> {
    if (this.disposed || !this.current) {
      return;
    }
    const now = Date.now();
    if (now - this.lastRestart < RESTART_WINDOW_MS) {
      this.logger.warn('Rádio: stream instável; encerrando', {
        channelId: this.current.channelId,
      });
      this.teardown();
      return;
    }
    this.lastRestart = now;
    try {
      const audio = await this.resolver.resolve(this.current.channelId);
      this.player?.play(audio);
      this.logger.info('Rádio: stream reaberto após queda', {
        channelId: this.current.channelId,
      });
    } catch (error) {
      this.logger.warn('Rádio: falha ao reabrir stream; encerrando', {
        error: (error as Error).message,
      });
      this.teardown();
    }
  }

  private teardown(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.current = null;
    this.player?.destroy();
    this.player = null;
    this.onDispose(this.guildId);
  }
}

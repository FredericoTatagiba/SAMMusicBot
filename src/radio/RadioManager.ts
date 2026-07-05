import { IVoiceConnector } from '../core/interfaces/IAudioPlayer';
import { ILogger } from '../core/interfaces/ILogger';
import { IRadioStreamResolver } from './IRadioStreamResolver';
import { RadioSession } from './RadioSession';

/**
 * Registry + Factory das sessões de rádio por servidor. Garante uma única
 * RadioSession por guildId e a remove quando ela se auto-descarta (stop,
 * queda de conexão ou stream instável). Espelha o QueueManager da música.
 */
export class RadioManager {
  private readonly sessions = new Map<string, RadioSession>();

  constructor(
    private readonly connector: IVoiceConnector,
    private readonly resolver: IRadioStreamResolver,
    private readonly logger: ILogger,
  ) {}

  /** Retorna a sessão do servidor, criando sob demanda. */
  getOrCreate(guildId: string): RadioSession {
    const existing = this.sessions.get(guildId);
    if (existing) {
      return existing;
    }
    // Checagem de identidade no dispose: um teardown tardio de sessão antiga
    // não pode apagar do mapa a sessão nova que já a substituiu.
    const session = new RadioSession(
      guildId,
      this.connector,
      this.resolver,
      this.logger.child({ guildId }),
      (id) => {
        if (this.sessions.get(id) === session) {
          this.sessions.delete(id);
        }
      },
    );
    this.sessions.set(guildId, session);
    return session;
  }

  /** Retorna a sessão existente ou null (sem criar). */
  get(guildId: string): RadioSession | null {
    return this.sessions.get(guildId) ?? null;
  }
}

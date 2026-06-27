import { IVoiceConnector } from '../core/interfaces/IAudioPlayer';
import { IStreamResolver } from '../core/interfaces/IStreamResolver';
import { ILogger } from '../core/interfaces/ILogger';
import { GuildMusicService } from './GuildMusicService';
import { MusicQueue } from './MusicQueue';

/**
 * Registry + Factory dos serviços de música por servidor.
 *
 * Garante um único GuildMusicService por guildId e cuida do ciclo de vida:
 * cria sob demanda e remove quando o serviço se auto-descarta (desconexão
 * por inatividade ou stop).
 */
export class QueueManager {
  private readonly services = new Map<string, GuildMusicService>();

  constructor(
    private readonly connector: IVoiceConnector,
    private readonly streamResolver: IStreamResolver,
    private readonly logger: ILogger,
    private readonly maxQueueSize: number,
    private readonly idleDisconnectMs: number,
  ) {}

  /** Retorna o serviço do servidor, criando-o se necessário. */
  getOrCreate(guildId: string): GuildMusicService {
    const existing = this.services.get(guildId);
    if (existing) {
      return existing;
    }
    // O dispose só remove ESTE serviço (checagem de identidade). Sem isto, o
    // teardown tardio de um serviço antigo apagava do mapa o serviço novo que
    // já o substituiu, deixando uma conexão órfã (música tocando, mas os
    // comandos respondendo "nada tocando"). O closure roda no descarte, bem
    // depois de `service` estar inicializada.
    const service = new GuildMusicService(
      guildId,
      new MusicQueue(this.maxQueueSize),
      this.connector,
      this.streamResolver,
      this.logger.child({ guildId }),
      this.idleDisconnectMs,
      (id) => {
        if (this.services.get(id) === service) {
          this.services.delete(id);
        }
      },
    );
    this.services.set(guildId, service);
    return service;
  }

  /** Retorna o serviço existente ou null (sem criar). */
  get(guildId: string): GuildMusicService | null {
    return this.services.get(guildId) ?? null;
  }
}

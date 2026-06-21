import { Client, Events, Guild } from 'discord.js';
import { IGuildAccessPolicy } from '../core/interfaces/IGuildAccessPolicy';
import { ILogger } from '../core/interfaces/ILogger';

/**
 * Faz cumprir a política de acesso por servidor.
 *
 * - Ao ser adicionado a um servidor não autorizado, o bot sai sozinho.
 * - Ao iniciar, varre os servidores em cache e sai dos não autorizados
 *   (cobre o caso de ter sido adicionado enquanto estava offline).
 *
 * É a primeira linha de defesa contra uso por terceiros: mesmo que alguém
 * convide o bot para outro servidor, ele não permanece lá.
 */
export class GuildGuard {
  constructor(
    private readonly client: Client,
    private readonly policy: IGuildAccessPolicy,
    private readonly logger: ILogger,
  ) {}

  register(): void {
    if (!this.policy.restricted) {
      return; // sem allowlist, nada a impor.
    }
    this.client.on(Events.GuildCreate, (guild) => {
      void this.enforce(guild);
    });
    this.client.once(Events.ClientReady, () => {
      this.sweep();
    });
  }

  private sweep(): void {
    for (const guild of this.client.guilds.cache.values()) {
      void this.enforce(guild);
    }
  }

  private async enforce(guild: Guild): Promise<void> {
    if (this.policy.isAllowed(guild.id)) {
      return;
    }
    this.logger.warn('Saindo de servidor não autorizado', {
      guildId: guild.id,
      name: guild.name,
    });
    try {
      await guild.leave();
    } catch (error) {
      this.logger.error('Falha ao sair do servidor não autorizado', {
        guildId: guild.id,
        error: (error as Error).message,
      });
    }
  }
}

import { Client, Events } from 'discord.js';
import { ILogger } from '../core/interfaces/ILogger';
import { DiscordMessageHandler } from '../discord/DiscordMessageHandler';
import { GuildGuard } from '../discord/GuildGuard';
import { AloneVoiceWatcher } from '../discord/AloneVoiceWatcher';

/**
 * Fachada do ciclo de vida do bot: registra os handlers e gerencia
 * login/logout. Não contém regra de negócio — apenas orquestra o cliente.
 */
export class MusicBot {
  constructor(
    private readonly client: Client,
    private readonly messageHandler: DiscordMessageHandler,
    private readonly guildGuard: GuildGuard,
    private readonly aloneWatcher: AloneVoiceWatcher,
    private readonly token: string,
    private readonly logger: ILogger,
  ) {}

  async start(): Promise<void> {
    this.client.once(Events.ClientReady, (ready) => {
      this.logger.info('Bot conectado ao Discord', { tag: ready.user.tag });
    });
    this.client.on(Events.Error, (error) => {
      this.logger.error('Erro no cliente do Discord', { error: error.message });
    });
    this.guildGuard.register();
    this.aloneWatcher.register();
    this.messageHandler.register();
    await this.client.login(this.token);
  }

  async stop(): Promise<void> {
    this.logger.info('Encerrando o bot');
    await this.client.destroy();
  }
}

import { Client, Events, Message } from 'discord.js';
import { ICommandContext } from '../core/interfaces/ICommand';
import { IGuildAccessPolicy } from '../core/interfaces/IGuildAccessPolicy';
import { ILogger } from '../core/interfaces/ILogger';
import { CommandDispatcher } from './CommandDispatcher';
import { parseCommand } from './parseCommand';

/**
 * Liga os eventos de mensagem do Discord ao CommandDispatcher.
 *
 * Responsabilidade: traduzir uma `Message` do discord.js no nosso
 * ICommandContext (Adapter), mantendo o resto do sistema desacoplado da API
 * do Discord.
 */
export class DiscordMessageHandler {
  constructor(
    private readonly client: Client,
    private readonly dispatcher: CommandDispatcher,
    private readonly prefix: string,
    private readonly logger: ILogger,
    private readonly accessPolicy: IGuildAccessPolicy,
  ) {}

  register(): void {
    this.client.on(Events.MessageCreate, (message) => {
      void this.handle(message);
    });
  }

  private async handle(message: Message): Promise<void> {
    if (message.author.bot || !message.inGuild()) {
      return;
    }
    // Ignora comandos de servidores não autorizados (defesa em profundidade,
    // além da saída automática feita pelo GuildGuard). Também ignora DMs,
    // pois `inGuild()` já barrou mensagens fora de servidores.
    if (!this.accessPolicy.isAllowed(message.guildId)) {
      return;
    }
    const parsed = parseCommand(message.content, this.prefix);
    if (!parsed) {
      return;
    }
    this.logger.debug('Comando recebido', {
      command: parsed.name,
      guildId: message.guildId,
    });
    const context = this.toContext(message, parsed.args);
    await this.dispatcher.dispatch(parsed.name, context);
  }

  private toContext(message: Message<true>, args: string[]): ICommandContext {
    return {
      guildId: message.guildId,
      userId: message.author.id,
      args,
      voiceChannelId: message.member?.voice.channelId ?? null,
      reply: async (content: string): Promise<void> => {
        await message.reply({
          content,
          allowedMentions: { repliedUser: false },
        });
      },
    };
  }
}

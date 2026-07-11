import { Client, Events, Message } from 'discord.js';
import { CommandError } from '../core/errors';
import { IGuildAccessPolicy } from '../core/interfaces/IGuildAccessPolicy';
import { ILogger } from '../core/interfaces/ILogger';
import { parseRadioCommand, RadioAction } from './parseRadioCommand';
import { RadioService } from './RadioService';
import { renderCountry, renderStations } from './render';

/**
 * Liga as mensagens com o prefixo da rádio ao RadioService. Vive num handler
 * próprio (separado do dispatcher de música) para manter o módulo apartado e
 * poder responder com embeds + menus interativos.
 */
export class RadioMessageHandler {
  constructor(
    private readonly client: Client,
    private readonly radio: RadioService,
    private readonly prefix: string,
    private readonly accessPolicy: IGuildAccessPolicy,
    private readonly logger: ILogger,
  ) {}

  register(): void {
    this.client.on(Events.MessageCreate, (message) => {
      void this.handle(message);
    });
    this.logger.info('Rádio: handler de comandos ativo', {
      prefix: this.prefix,
    });
  }

  private async handle(message: Message): Promise<void> {
    if (message.author.bot || !message.inGuild()) {
      return;
    }
    if (!this.accessPolicy.isAllowed(message.guildId)) {
      return;
    }
    const action = parseRadioCommand(message.content, this.prefix);
    if (!action) {
      return;
    }
    this.logger.info('Rádio: comando recebido', { kind: action.kind });
    try {
      await this.dispatch(action, message);
    } catch (error) {
      const known = error instanceof CommandError;
      if (!known) {
        this.logger.error('Rádio: erro ao executar comando', {
          error: (error as Error).message,
        });
      }
      await this.reply(
        message,
        `⚠️ ${
          known
            ? (error as CommandError).message
            : 'Não consegui falar com a rádio agora. Tenta de novo.'
        }`,
      );
    }
  }

  private async dispatch(
    action: RadioAction,
    message: Message<true>,
  ): Promise<void> {
    if (action.kind === 'help') {
      await this.reply(message, this.helpText());
      return;
    }
    if (action.kind === 'stop') {
      const stopped = this.radio.stop(message.guildId);
      await this.reply(
        message,
        stopped ? '⏹️ Rádio parada.' : 'Não há rádio tocando.',
      );
      return;
    }

    // A partir daqui é 'search' ou 'lookup': precisa de canal de voz.
    const voiceChannelId = message.member?.voice.channelId ?? null;
    if (!voiceChannelId) {
      throw new CommandError('Entre em um canal de voz primeiro.');
    }

    const userId = message.author.id;
    const payload =
      action.kind === 'search'
        ? renderStations({
            title: `Resultados para "${action.query}"`,
            stations: await this.radio.searchStations(action.query),
            userId,
          })
        : await this.buildLookup(action.query, userId);

    await message.reply({
      embeds: payload.embeds,
      components: payload.components,
      allowedMentions: { repliedUser: false },
    });
  }

  private async buildLookup(query: string, userId: string) {
    const result = await this.radio.lookup(query);
    if (result.kind === 'country') {
      return renderCountry(result.view, userId);
    }
    return renderStations({
      title: `Resultados para "${result.query}"`,
      stations: result.stations,
      userId,
    });
  }

  private async reply(message: Message, content: string): Promise<void> {
    try {
      await message.reply({ content, allowedMentions: { repliedUser: false } });
    } catch (error) {
      this.logger.warn('Rádio: falha ao responder', {
        error: (error as Error).message,
      });
    }
  }

  private helpText(): string {
    const p = this.prefix;
    return [
      '📻 **Rádio — como usar:**',
      `\`${p}radio <país>\` — estações populares do país (ex.: \`${p}radio Brazil\`)`,
      `\`${p}radio search <termo>\` — busca livre por estação/cidade (ex.: \`${p}radio search jazz\`)`,
      `\`${p}radio stop\` — para a rádio e sai do canal`,
      'Depois é só escolher a estação no menu. Você precisa estar num canal de voz.',
    ].join('\n');
  }
}

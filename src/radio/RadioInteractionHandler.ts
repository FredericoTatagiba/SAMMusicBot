import {
  ButtonInteraction,
  Client,
  Events,
  GuildMember,
  Interaction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { ILogger } from '../core/interfaces/ILogger';
import { RadioService } from './RadioService';
import { renderCities, renderNowPlaying, renderStations } from './render';

type RadioInteraction = StringSelectMenuInteraction | ButtonInteraction;

/**
 * Trata os cliques nos menus/botões da rádio (customId `radio:*`). Todo o
 * contexto necessário viaja no próprio customId (placeId, autor) ou no valor
 * selecionado (channelId/cityId) — nenhum estado é guardado em memória.
 */
export class RadioInteractionHandler {
  constructor(
    private readonly client: Client,
    private readonly radio: RadioService,
    private readonly logger: ILogger,
  ) {}

  register(): void {
    this.client.on(Events.InteractionCreate, (interaction) => {
      void this.handle(interaction);
    });
    this.logger.info('Rádio: handler de interações ativo');
  }

  private async handle(interaction: Interaction): Promise<void> {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) {
      return;
    }
    if (!interaction.customId.startsWith('radio:')) {
      return;
    }
    try {
      await this.route(interaction);
    } catch (error) {
      this.logger.error('Rádio: erro na interação', {
        error: (error as Error).message,
      });
      await this.fail(interaction);
    }
  }

  private async route(interaction: RadioInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const guildId = interaction.guildId;
    if (!guildId) {
      return;
    }

    if (action === 'stop') {
      this.radio.stop(guildId);
      await interaction.update({
        content: '⏹️ Rádio parada.',
        embeds: [],
        components: [],
      });
      return;
    }

    // Ações restritas ao autor: o último segmento do customId é o userId.
    const ownerId = parts[parts.length - 1];
    if (ownerId && interaction.user.id !== ownerId) {
      await interaction.reply({ content: 'Esse menu não é seu 🙂', ephemeral: true });
      return;
    }

    // As ações abaixo fazem chamadas de rede (buscar canal, conectar voz,
    // resolver o stream) que podem passar dos 3s do Discord. Confirma a
    // interação já com deferUpdate (senão vira "Esta interação falhou") e
    // atualiza a mensagem depois com editReply.
    await interaction.deferUpdate();

    if (action === 'cities' && interaction.isButton()) {
      const view = await this.radio.countryView(parts[2]);
      await interaction.editReply(
        renderCities(view.title, view.cities, interaction.user.id),
      );
      return;
    }

    if (action === 'city' && interaction.isStringSelectMenu()) {
      const stations = await this.radio.cityChannels(interaction.values[0]);
      await interaction.editReply(
        renderStations({
          title: 'Estações',
          stations,
          userId: interaction.user.id,
        }),
      );
      return;
    }

    if (action === 'play' && interaction.isStringSelectMenu()) {
      const voiceChannelId = await resolveVoiceChannel(interaction);
      if (!voiceChannelId) {
        await interaction.followUp({
          content: 'Entre em um canal de voz primeiro.',
          ephemeral: true,
        });
        return;
      }
      const station = await this.radio.resolveStation(interaction.values[0]);
      await this.radio.play(guildId, voiceChannelId, station);
      await interaction.editReply(renderNowPlaying(station));
    }
  }

  private async fail(interaction: RadioInteraction): Promise<void> {
    const content = 'Não consegui completar isso agora. Tenta de novo.';
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, ephemeral: true });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    } catch {
      /* interação pode ter expirado; nada a fazer */
    }
  }
}

/** Canal de voz atual do usuário que interagiu (busca fresca se preciso). */
async function resolveVoiceChannel(
  interaction: RadioInteraction,
): Promise<string | null> {
  const guild = interaction.guild;
  if (!guild) {
    return null;
  }
  const member =
    interaction.member instanceof GuildMember
      ? interaction.member
      : await guild.members.fetch(interaction.user.id).catch(() => null);
  return member?.voice.channelId ?? null;
}

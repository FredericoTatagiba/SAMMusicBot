import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { RadioPlaceRef, RadioPlaceView, RadioStation } from './types';

/** Cor dos embeds da rádio (blurple). */
const ACCENT = 0x5865f2;
/** Limite do Discord para opções por menu de seleção. */
const MAX_OPTIONS = 25;

type Row = ActionRowBuilder<MessageActionRowComponentBuilder>;

/** Payload pronto para `message.reply` / `interaction.update`. */
export interface RadioMessagePayload {
  readonly embeds: EmbedBuilder[];
  readonly components: Row[];
}

/** Resultados de busca (ou estações de uma cidade) num menu de seleção. */
export function renderStations(params: {
  title: string;
  subtitle?: string;
  stations: readonly RadioStation[];
  userId: string;
}): RadioMessagePayload {
  const stations = params.stations.filter((station) => station.channelId);
  if (stations.length === 0) {
    return {
      embeds: [embed('Nada encontrado', 'Tente outro termo ou uma cidade.')],
      components: [],
    };
  }
  const shown = stations.slice(0, MAX_OPTIONS);
  const note =
    stations.length > MAX_OPTIONS
      ? `Mostrando ${MAX_OPTIONS} de ${stations.length} — refine a busca para ver outras.`
      : params.subtitle;
  return {
    embeds: [embed(params.title, note)],
    components: [stationSelect(shown, params.userId)],
  };
}

/** Página de país: estações populares + botão para explorar cidades. */
export function renderCountry(
  view: RadioPlaceView,
  userId: string,
): RadioMessagePayload {
  const rows: Row[] = [];
  if (view.stations.length > 0) {
    rows.push(stationSelect(view.stations.slice(0, MAX_OPTIONS), userId));
  }
  if (view.cities.length > 0) {
    rows.push(
      buttonRow(
        new ButtonBuilder()
          .setCustomId(`radio:cities:${view.placeId}:${userId}`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel('Explorar cidades'),
      ),
    );
  }
  const subtitle =
    view.stations.length > 0
      ? 'Escolha uma estação ou explore por cidade.'
      : 'Escolha uma cidade para ver as estações.';
  return {
    embeds: [embed(`Rádios populares em ${view.title}`, subtitle)],
    components: rows,
  };
}

/** Lista de cidades de um país num menu de seleção. */
export function renderCities(
  countryTitle: string,
  cities: readonly RadioPlaceRef[],
  userId: string,
): RadioMessagePayload {
  const shown = cities.filter((city) => city.placeId).slice(0, MAX_OPTIONS);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`radio:city:${userId}`)
    .setPlaceholder('Escolha uma cidade')
    .addOptions(
      shown.map((city) => ({
        label: truncate(city.title, 100),
        value: city.placeId.slice(0, 100),
        ...(city.count
          ? { description: `${city.count} estações` }
          : {}),
      })),
    );
  return {
    embeds: [embed(`Cidades em ${countryTitle}`, 'Escolha uma cidade.')],
    components: [row(menu)],
  };
}

/** Embed de "tocando agora" com botão de parar. */
export function renderNowPlaying(station: RadioStation): RadioMessagePayload {
  const description = station.subtitle
    ? `${station.subtitle} · ao vivo`
    : 'ao vivo';
  return {
    embeds: [embed(`▶️ Tocando agora — ${station.title}`, description)],
    components: [
      buttonRow(
        new ButtonBuilder()
          .setCustomId('radio:stop')
          .setStyle(ButtonStyle.Danger)
          .setLabel('Parar'),
      ),
    ],
  };
}

/* ------------------------------- helpers ------------------------------- */

function stationSelect(stations: readonly RadioStation[], userId: string): Row {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`radio:play:${userId}`)
    .setPlaceholder('Escolha uma estação')
    .addOptions(
      stations.map((station) => ({
        label: truncate(station.title, 100),
        value: station.channelId.slice(0, 100),
        ...(station.subtitle
          ? { description: truncate(station.subtitle, 100) }
          : {}),
      })),
    );
  return row(menu);
}

function embed(title: string, description?: string): EmbedBuilder {
  const builder = new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle(truncate(title, 256));
  if (description) {
    builder.setDescription(truncate(description, 4096));
  }
  return builder;
}

function row(component: MessageActionRowComponentBuilder): Row {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    component,
  );
}

function buttonRow(...buttons: ButtonBuilder[]): Row {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    ...buttons,
  );
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

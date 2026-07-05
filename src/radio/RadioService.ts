import { ILogger } from '../core/interfaces/ILogger';
import { IRadioDirectory } from './IRadioDirectory';
import { RadioManager } from './RadioManager';
import {
  RadioLookupResult,
  RadioPlaceView,
  RadioStation,
} from './types';

/**
 * Orquestra o módulo de rádio: consulta o diretório (Radio Garden), decide o
 * fluxo híbrido (país vs. busca) e comanda o playback. Ao iniciar a rádio,
 * para a música do servidor (exclusão mútua da conexão de voz) via callback
 * injetado — sem acoplar o módulo ao QueueManager.
 */
export class RadioService {
  constructor(
    private readonly directory: IRadioDirectory,
    private readonly manager: RadioManager,
    private readonly logger: ILogger,
    private readonly stopMusic: (guildId: string) => void,
  ) {}

  /**
   * Entrada "inteligente" do híbrido: se o texto casa um país, devolve a
   * visão do país (populares + cidades); senão, as estações encontradas.
   */
  async lookup(query: string): Promise<RadioLookupResult> {
    const hits = await this.directory.search(query);
    const country = hits.find((hit) => hit.type === 'country');
    if (country) {
      return { kind: 'country', view: await this.directory.getPlace(country.id) };
    }
    const stations = toStations(hits);
    if (stations.length > 0) {
      return { kind: 'stations', query, stations };
    }
    // Sem país nem canais diretos: se veio uma cidade, abre a página dela
    // (populares + cidades) em vez de responder "nada encontrado".
    const place = hits.find((hit) => hit.type === 'place');
    if (place) {
      return { kind: 'country', view: await this.directory.getPlace(place.id) };
    }
    return { kind: 'stations', query, stations: [] };
  }

  /** Busca livre: só estações que casam o termo. */
  async searchStations(query: string): Promise<readonly RadioStation[]> {
    const hits = await this.directory.search(query);
    return toStations(hits);
  }

  /** Recarrega a visão de um país (para o botão "Explorar cidades"). */
  countryView(placeId: string): Promise<RadioPlaceView> {
    return this.directory.getPlace(placeId);
  }

  /** Estações de uma cidade. */
  cityChannels(placeId: string): Promise<readonly RadioStation[]> {
    return this.directory.getPlaceChannels(placeId);
  }

  /** Detalhes de uma estação (título + "Cidade, País") para exibir/tocar. */
  resolveStation(channelId: string): Promise<RadioStation> {
    return this.directory.getChannel(channelId);
  }

  /** Toca uma estação, parando a música do servidor antes (exclusão mútua). */
  async play(
    guildId: string,
    voiceChannelId: string,
    station: RadioStation,
  ): Promise<void> {
    this.stopMusic(guildId);
    await this.manager.getOrCreate(guildId).play(voiceChannelId, station);
    this.logger.info('Rádio: iniciada', { guildId, title: station.title });
  }

  /** Para a rádio do servidor. Retorna false se não havia nada tocando. */
  stop(guildId: string): boolean {
    const session = this.manager.get(guildId);
    if (!session) {
      return false;
    }
    session.stop();
    return true;
  }

  /** Estação tocando agora nesse servidor, ou null. */
  nowPlaying(guildId: string): RadioStation | null {
    return this.manager.get(guildId)?.station ?? null;
  }
}

/** Converte hits de canal em estações (ignora lugares/países). */
function toStations(
  hits: readonly { type: string; id: string; title: string; subtitle?: string }[],
): RadioStation[] {
  return hits
    .filter((hit) => hit.type === 'channel')
    .map((hit) => ({ channelId: hit.id, title: hit.title, subtitle: hit.subtitle }));
}

import { RadioPlaceView, RadioSearchHit, RadioStation } from './types';

/**
 * Provedor de dados de rádio (Radio Garden), atrás de interface para que o
 * serviço seja testável com um fake — sem rede (Dependency Inversion).
 */
export interface IRadioDirectory {
  /** Busca países, cidades e estações por texto livre. */
  search(query: string): Promise<readonly RadioSearchHit[]>;
  /** Página de um lugar: país → populares + cidades; cidade → estações. */
  getPlace(placeId: string): Promise<RadioPlaceView>;
  /** Lista todas as estações de uma cidade. */
  getPlaceChannels(placeId: string): Promise<readonly RadioStation[]>;
  /** Detalhes de uma estação (título + "Cidade, País"). */
  getChannel(channelId: string): Promise<RadioStation>;
}

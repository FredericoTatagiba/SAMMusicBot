/**
 * Tipos do módulo de rádio. Normalizam as respostas do Radio Garden em
 * estruturas simples, desacopladas da forma bruta da API — as camadas de
 * cima (serviço, render, handlers) dependem só destes tipos.
 */

/** Uma estação de rádio (canal) resolvida do Radio Garden. */
export interface RadioStation {
  /** ID do canal na API (usado para tocar e para detalhes). */
  readonly channelId: string;
  readonly title: string;
  /** Legenda opcional: "Cidade, País" (busca) ou a cidade. */
  readonly subtitle?: string;
}

/** Referência a um lugar (país ou cidade) para navegação. */
export interface RadioPlaceRef {
  readonly placeId: string;
  readonly title: string;
  /** Nº de estações, quando informado (cidades). */
  readonly count?: number;
}

/** Tipo de um resultado de busca. */
export type RadioHitType = 'channel' | 'place' | 'country';

/** Resultado de busca normalizado (`/search`). */
export interface RadioSearchHit {
  readonly type: RadioHitType;
  readonly title: string;
  readonly subtitle?: string;
  /** channelId quando type=channel; placeId quando place/country. */
  readonly id: string;
}

/** Página de um lugar: país (populares + cidades) ou cidade (estações). */
export interface RadioPlaceView {
  readonly placeId: string;
  readonly title: string;
  /** Estações populares mostradas diretamente. */
  readonly stations: readonly RadioStation[];
  /** Cidades para drill-down (quando é país). */
  readonly cities: readonly RadioPlaceRef[];
}

/**
 * Resultado do "smart lookup" híbrido: se o texto casa um país, devolve a
 * visão do país (populares + cidades); senão, as estações encontradas.
 */
export type RadioLookupResult =
  | { readonly kind: 'country'; readonly view: RadioPlaceView }
  | { readonly kind: 'stations'; readonly query: string; readonly stations: readonly RadioStation[] };

import { SourceType, Track } from '../types';

/**
 * Strategy de resolução de faixas para uma plataforma de streaming.
 *
 * Cada plataforma (YouTube, Spotify, SoundCloud) implementa esta interface.
 * O SearchService seleciona a strategy adequada via `supports()`, mantendo
 * o Open/Closed Principle: novas fontes entram sem alterar o orquestrador.
 */
export interface ISourceProvider {
  /** Plataforma atendida por este provider. */
  readonly source: SourceType;

  /**
   * Indica se este provider sabe lidar com a entrada (URL ou termo de busca).
   * Deve ser barato e síncrono — apenas inspeção de padrão/URL.
   */
  supports(query: string): boolean;

  /**
   * Resolve a entrada em uma ou mais faixas (metadados, sem stream de áudio).
   * Um link de playlist pode retornar várias faixas; uma busca textual deve
   * retornar a melhor correspondência.
   *
   * @throws TrackNotFoundError quando nada é encontrado.
   */
  resolve(query: string): Promise<Track[]>;
}

import { AudioStream, Track } from '../types';

/**
 * Converte uma faixa (metadados) em um stream de áudio reproduzível.
 *
 * Separado de ISourceProvider (Single Responsibility): resolver metadados e
 * obter bytes de áudio são responsabilidades distintas. Faixas do Spotify,
 * por exemplo, têm metadados na fonte mas o áudio é resolvido em outra
 * plataforma — detalhe que fica encapsulado aqui.
 */
export interface IStreamResolver {
  /**
   * @throws StreamResolutionError quando o áudio não pode ser obtido.
   */
  resolve(track: Track): Promise<AudioStream>;
}

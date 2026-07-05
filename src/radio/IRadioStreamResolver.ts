import { AudioStream } from '../core/types';

/**
 * Resolve o áudio ao vivo de uma estação. Abstrai o endpoint `channel.mp3`
 * (que responde 302 para o stream real) atrás de uma interface, permitindo
 * testar o playback com um fake — sem rede.
 */
export interface IRadioStreamResolver {
  resolve(channelId: string): Promise<AudioStream>;
}

import { LogLevel } from '../types';

/** Credenciais opcionais do Spotify. */
export interface SpotifyCredentials {
  readonly clientId?: string;
  readonly clientSecret?: string;
}

/** Configuração imutável da aplicação, validada na inicialização. */
export interface BotConfig {
  readonly discordToken: string;
  readonly commandPrefix: string;
  readonly spotify: SpotifyCredentials;
  readonly maxQueueSize: number;
  readonly idleDisconnectMs: number;
  /** Tempo (ms) sozinho no canal de voz antes de parar a reprodução. */
  readonly emptyChannelTimeoutMs: number;
  readonly logLevel: LogLevel;
  /** IDs dos servidores autorizados. Vazio = sem restrição. */
  readonly allowedGuildIds: readonly string[];
}

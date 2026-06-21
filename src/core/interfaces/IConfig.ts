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
  readonly logLevel: LogLevel;
  /** IDs dos servidores autorizados. Vazio = sem restrição. */
  readonly allowedGuildIds: readonly string[];
}

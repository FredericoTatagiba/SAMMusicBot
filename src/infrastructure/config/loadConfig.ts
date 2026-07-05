import { config as loadDotenv } from 'dotenv';
import { BotConfig } from '../../core/interfaces/IConfig';
import { ConfigurationError } from '../../core/errors';
import { LogLevel } from '../../core/types';

/** Base padrão da API do Radio Garden. */
const DEFAULT_RADIO_API_URL = 'https://radio.garden/api';

function requireEnv(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name];
  if (!value || value.trim().length === 0) {
    throw new ConfigurationError(
      `Variável de ambiente obrigatória ausente: ${name}.`,
    );
  }
  return value.trim();
}

function parsePositiveInt(
  name: string,
  raw: string | undefined,
  fallback: number,
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value <= 0) {
    throw new ConfigurationError(
      `Variável ${name} deve ser um inteiro positivo (recebido: "${raw}").`,
    );
  }
  return value;
}

function parseList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseLogLevel(raw: string | undefined): LogLevel {
  const value = (raw ?? LogLevel.Info).toLowerCase();
  const allowed = Object.values(LogLevel) as string[];
  if (!allowed.includes(value)) {
    throw new ConfigurationError(
      `LOG_LEVEL inválido: "${raw}". Use um de: ${allowed.join(', ')}.`,
    );
  }
  return value as LogLevel;
}

/**
 * Carrega e valida a configuração a partir do ambiente.
 * Recebe `env` por injeção para ser testável sem variáveis globais.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  loadDotenv();

  const commandPrefix = (env.COMMAND_PREFIX ?? '!').trim() || '!';

  return {
    discordToken: requireEnv('DISCORD_TOKEN', env),
    commandPrefix,
    radioApiBaseUrl:
      (env.RADIO_API_BASE_URL ?? DEFAULT_RADIO_API_URL).trim() ||
      DEFAULT_RADIO_API_URL,
    spotify: {
      clientId: env.SPOTIFY_CLIENT_ID?.trim() || undefined,
      clientSecret: env.SPOTIFY_CLIENT_SECRET?.trim() || undefined,
    },
    maxQueueSize: parsePositiveInt('MAX_QUEUE_SIZE', env.MAX_QUEUE_SIZE, 200),
    idleDisconnectMs: parsePositiveInt(
      'IDLE_DISCONNECT_MS',
      env.IDLE_DISCONNECT_MS,
      10_000,
    ),
    emptyChannelTimeoutMs: parsePositiveInt(
      'EMPTY_CHANNEL_TIMEOUT_MS',
      env.EMPTY_CHANNEL_TIMEOUT_MS,
      20_000,
    ),
    logLevel: parseLogLevel(env.LOG_LEVEL),
    allowedGuildIds: parseList(env.ALLOWED_GUILD_IDS),
  };
}

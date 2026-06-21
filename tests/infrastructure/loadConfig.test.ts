import { loadConfig } from '../../src/infrastructure/config/loadConfig';
import { ConfigurationError } from '../../src/core/errors';
import { LogLevel } from '../../src/core/types';

const BASE_ENV: NodeJS.ProcessEnv = { DISCORD_TOKEN: 'tok' };

describe('loadConfig', () => {
  it('exige DISCORD_TOKEN', () => {
    expect(() => loadConfig({})).toThrow(ConfigurationError);
  });

  it('aplica padrões sensatos', () => {
    const config = loadConfig({ ...BASE_ENV });
    expect(config.commandPrefix).toBe('!');
    expect(config.maxQueueSize).toBe(200);
    expect(config.idleDisconnectMs).toBe(300_000);
    expect(config.logLevel).toBe(LogLevel.Info);
    expect(config.spotify.clientId).toBeUndefined();
  });

  it('lê valores customizados', () => {
    const config = loadConfig({
      ...BASE_ENV,
      COMMAND_PREFIX: '?',
      MAX_QUEUE_SIZE: '50',
      LOG_LEVEL: 'debug',
      SPOTIFY_CLIENT_ID: 'cid',
      SPOTIFY_CLIENT_SECRET: 'sec',
    });
    expect(config.commandPrefix).toBe('?');
    expect(config.maxQueueSize).toBe(50);
    expect(config.logLevel).toBe(LogLevel.Debug);
    expect(config.spotify).toEqual({ clientId: 'cid', clientSecret: 'sec' });
  });

  it('faz parse de ALLOWED_GUILD_IDS separados por vírgula', () => {
    const config = loadConfig({
      ...BASE_ENV,
      ALLOWED_GUILD_IDS: ' 111, 222 ,, 333 ',
    });
    expect(config.allowedGuildIds).toEqual(['111', '222', '333']);
  });

  it('ALLOWED_GUILD_IDS ausente vira lista vazia', () => {
    expect(loadConfig({ ...BASE_ENV }).allowedGuildIds).toEqual([]);
  });

  it('rejeita inteiros inválidos', () => {
    expect(() => loadConfig({ ...BASE_ENV, MAX_QUEUE_SIZE: '-5' })).toThrow(
      ConfigurationError,
    );
  });

  it('rejeita LOG_LEVEL inválido', () => {
    expect(() => loadConfig({ ...BASE_ENV, LOG_LEVEL: 'verbose' })).toThrow(
      ConfigurationError,
    );
  });
});

import { loadConfig } from '../../src/infrastructure/config/loadConfig';

const BASE_ENV: NodeJS.ProcessEnv = { DISCORD_TOKEN: 'tok' };

describe('loadConfig — rádio', () => {
  it('usa a base pública do Radio Garden por padrão', () => {
    expect(loadConfig({ ...BASE_ENV }).radioApiBaseUrl).toBe(
      'https://radio.garden/api',
    );
  });

  it('respeita RADIO_API_BASE_URL', () => {
    const config = loadConfig({
      ...BASE_ENV,
      RADIO_API_BASE_URL: 'http://proxy.local/api',
    });
    expect(config.radioApiBaseUrl).toBe('http://proxy.local/api');
  });
});

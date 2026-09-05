import { buildYtDlpHardeningOptions } from '../../src/infrastructure/ytdlp/ytdlpHardening';

describe('buildYtDlpHardeningOptions', () => {
  it('usa o player_client padrão (tv,web_safari) quando nada é definido', () => {
    const opts = buildYtDlpHardeningOptions({} as NodeJS.ProcessEnv);

    expect(opts.extractorArgs).toBe('youtube:player_client=tv,web_safari');
  });

  it('respeita YTDLP_PLAYER_CLIENT quando definido', () => {
    const opts = buildYtDlpHardeningOptions({
      YTDLP_PLAYER_CLIENT: 'ios',
    } as NodeJS.ProcessEnv);

    expect(opts.extractorArgs).toBe('youtube:player_client=ios');
  });

  it('NÃO envia cookies por padrão (evita deslogar com o cliente tv)', () => {
    const opts = buildYtDlpHardeningOptions({} as NodeJS.ProcessEnv);

    expect(opts).not.toHaveProperty('cookiesFromBrowser');
    expect(opts).not.toHaveProperty('cookies');
  });

  it('inclui cookiesFromBrowser apenas quando definido', () => {
    const opts = buildYtDlpHardeningOptions({
      YTDLP_COOKIES_FROM_BROWSER: 'firefox',
    } as NodeJS.ProcessEnv);

    expect(opts.cookiesFromBrowser).toBe('firefox');
  });

  it('inclui cookies (arquivo) apenas quando definido', () => {
    const opts = buildYtDlpHardeningOptions({
      YTDLP_COOKIES_FILE: '/tmp/cookies.txt',
    } as NodeJS.ProcessEnv);

    expect(opts.cookies).toBe('/tmp/cookies.txt');
  });

  it('ignora valores em branco (trata como ausentes)', () => {
    const opts = buildYtDlpHardeningOptions({
      YTDLP_PLAYER_CLIENT: '   ',
      YTDLP_COOKIES_FROM_BROWSER: '  ',
    } as NodeJS.ProcessEnv);

    expect(opts.extractorArgs).toBe('youtube:player_client=tv,web_safari');
    expect(opts).not.toHaveProperty('cookiesFromBrowser');
  });
});

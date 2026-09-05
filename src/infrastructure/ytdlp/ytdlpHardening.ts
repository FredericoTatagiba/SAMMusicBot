/**
 * Opções compartilhadas que endurecem a extração do yt-dlp contra o bloqueio
 * anti-bot do YouTube ("Sign in to confirm you're not a bot" / HTTP 403).
 *
 * Centraliza, num único ponto (DRY), o conhecimento da "corrida armamentista"
 * YouTube × yt-dlp: tanto a extração de metadados quanto o streaming de áudio
 * batem no mesmo muro e exigem exatamente as mesmas flags. Sem isto, cada faixa
 * "termina" instantaneamente (playbackMs = 0) porque o yt-dlp sai com erro sem
 * produzir áudio.
 *
 * Por que estas flags:
 * - `extractorArgs: youtube:player_client=<clients>` — o cliente `tv` é o menos
 *   fiscalizado pelo YouTube e funciona sem credenciais na maioria dos casos;
 *   `web_safari` entra como fallback. Trocar de cliente contorna a verificação
 *   de origem (proof-of-origin) que cookies, sozinhos, já não resolvem.
 * - `cookiesFromBrowser` / `cookies` — OPCIONAIS, só para conteúdo restrito
 *   (idade/membros). Ficam desligados por padrão: misturar cookies com o
 *   cliente `tv` pode invalidar a sessão.
 *
 * Tudo é configurável por ambiente para permitir reajuste rápido quando o
 * YouTube mudar de novo, sem recompilar/redeploy.
 */

/** Cliente(s) de player padrão do yt-dlp. Ordem = prioridade de tentativa. */
const DEFAULT_PLAYER_CLIENT = 'tv,web_safari';

/**
 * Flags do yt-dlp mapeadas para o formato camelCase do `youtube-dl-exec`
 * (que as converte para `--extractor-args`, `--cookies-from-browser`, etc.).
 */
export interface YtDlpHardeningOptions {
  /** `--extractor-args`; ex.: `youtube:player_client=tv,web_safari`. */
  readonly extractorArgs: string;
  /** `--cookies-from-browser`; ex.: `firefox`. Opcional. */
  readonly cookiesFromBrowser?: string;
  /** `--cookies`; caminho para um arquivo cookies.txt. Opcional. */
  readonly cookies?: string;
}

/**
 * Constrói as opções de endurecimento a partir do ambiente. Recebe `env` por
 * injeção (como `loadConfig`) para ser testável sem variáveis globais.
 *
 * Variáveis suportadas:
 * - `YTDLP_PLAYER_CLIENT`       (padrão: `tv,web_safari`)
 * - `YTDLP_COOKIES_FROM_BROWSER`(ex.: `firefox`, `chrome`)
 * - `YTDLP_COOKIES_FILE`        (caminho para cookies.txt)
 */
export function buildYtDlpHardeningOptions(
  env: NodeJS.ProcessEnv = process.env,
): YtDlpHardeningOptions {
  const playerClient =
    env.YTDLP_PLAYER_CLIENT?.trim() || DEFAULT_PLAYER_CLIENT;
  const cookiesFromBrowser = env.YTDLP_COOKIES_FROM_BROWSER?.trim();
  const cookies = env.YTDLP_COOKIES_FILE?.trim();

  return {
    extractorArgs: `youtube:player_client=${playerClient}`,
    // Só entram quando definidos: flags vazias confundem o yt-dlp.
    ...(cookiesFromBrowser ? { cookiesFromBrowser } : {}),
    ...(cookies ? { cookies } : {}),
  };
}

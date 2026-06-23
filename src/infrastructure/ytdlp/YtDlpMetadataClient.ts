import youtubedl from 'youtube-dl-exec';

/**
 * Metadados de uma faixa ou de uma playlist, extraídos pelo yt-dlp.
 *
 * Reproduzimos apenas o subconjunto de campos que consumimos, evitando
 * acoplar o domínio à tipagem completa do yt-dlp (Dependency Inversion).
 * Em playlists, `entries` traz cada faixa; em faixas únicas, vem ausente.
 */
export interface YtDlpInfo {
  /** Discriminador do yt-dlp: 'playlist', 'video', 'url', etc. */
  readonly _type?: string;
  readonly id?: string;
  readonly title?: string;
  /** URL canônica da página (faixa única). */
  readonly webpage_url?: string;
  /** URL bruta — usada por entries em modo flat. */
  readonly url?: string;
  /** Duração em segundos (pode faltar em lives/parciais). */
  readonly duration?: number;
  readonly channel?: string;
  readonly uploader?: string;
  readonly thumbnail?: string;
  /** Faixas de uma playlist/set ou resultados de uma busca. */
  readonly entries?: ReadonlyArray<YtDlpInfo>;
}

/** Opções de extração mapeadas para flags do yt-dlp. */
export interface YtDlpExtractOptions {
  /** `--flat-playlist`: lista as faixas sem baixar metadados completos. */
  readonly flatPlaylist?: boolean;
  /** `--no-playlist`: resolve só o vídeo, ignorando a playlist da URL. */
  readonly noPlaylist?: boolean;
}

/**
 * Abstração de extração de metadados via yt-dlp. Injetável nos providers
 * (Dependency Inversion), o que os mantém testáveis sem rede nem binário.
 */
export interface YtDlpMetadataClient {
  /**
   * Extrai metadados (JSON) de uma URL ou de um alvo de busca
   * (ex.: `ytsearch1:...`, `scsearch1:...`).
   *
   * @throws Error quando o yt-dlp falha (URL inválida, rede, etc.).
   */
  extract(target: string, options?: YtDlpExtractOptions): Promise<YtDlpInfo>;
}

/**
 * Implementação padrão sobre `youtube-dl-exec`. O yt-dlp é o extrator mais
 * robusto e atualizado para YouTube/SoundCloud, onde as libs em JS puro
 * (play-dl, ytdl-core) falham. Usa `--dump-single-json` para obter um único
 * objeto JSON com tudo que precisamos.
 */
export class ExecYtDlpMetadataClient implements YtDlpMetadataClient {
  async extract(
    target: string,
    options: YtDlpExtractOptions = {},
  ): Promise<YtDlpInfo> {
    // O youtube-dl-exec transforma um booleano `false` na flag negada do yt-dlp
    // (ex.: `noPlaylist: false` vira `--no-no-playlist`, que é inválida).
    // Por isso só incluímos as flags booleanas opcionais quando verdadeiras.
    const payload = await youtubedl(
      target,
      {
        dumpSingleJson: true,
        noWarnings: true,
        quiet: true,
        ...(options.flatPlaylist ? { flatPlaylist: true } : {}),
        ...(options.noPlaylist ? { noPlaylist: true } : {}),
      },
      // windowsHide evita que a janela de console do yt-dlp pisque no Windows.
      { windowsHide: true },
    );

    // Com `dumpSingleJson`, o youtube-dl-exec resolve o stdout já parseado.
    return payload as unknown as YtDlpInfo;
  }
}

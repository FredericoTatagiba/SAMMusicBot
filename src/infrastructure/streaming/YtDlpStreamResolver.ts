import youtubedl from 'youtube-dl-exec';
import ffmpegStatic from 'ffmpeg-static';
import { ILogger } from '../../core/interfaces/ILogger';
import { IStreamResolver } from '../../core/interfaces/IStreamResolver';
import { AudioStream, AudioStreamType, SourceType, Track } from '../../core/types';
import { StreamResolutionError } from '../../core/errors';

/** Quantidade máxima de bytes de stderr mantidos para diagnóstico. */
const STDERR_TAIL_LIMIT = 2000;

/**
 * Descobre o binário do ffmpeg para o yt-dlp. Preferimos `FFMPEG_PATH`
 * (override explícito), caindo para o binário empacotado pelo `ffmpeg-static`
 * — o mesmo que o @discordjs/voice usa para transcodificar. Retorna `null`
 * quando nada é encontrado, deixando o yt-dlp procurar no PATH do sistema.
 */
export function resolveFfmpegPath(): string | null {
  return process.env.FFMPEG_PATH ?? ffmpegStatic ?? null;
}

/**
 * Resolve o áudio usando o yt-dlp (via youtube-dl-exec).
 *
 * O yt-dlp é o extrator mais robusto e atualizado para YouTube/SoundCloud —
 * onde as bibliotecas em JS puro (play-dl, ytdl-core) falham com 403 em 2026.
 * O processo escreve o melhor áudio em stdout, que entregamos ao
 * @discordjs/voice (o ffmpeg transcodifica). Tudo atrás de IStreamResolver.
 */
export class YtDlpStreamResolver implements IStreamResolver {
  constructor(
    private readonly logger: ILogger,
    // Injetável (Dependency Inversion) e testável; por padrão localiza sozinho.
    private readonly ffmpegPath: string | null = resolveFfmpegPath(),
  ) {}

  async resolve(track: Track): Promise<AudioStream> {
    const target = this.buildTarget(track);
    try {
      const subprocess = youtubedl.exec(
        target,
        this.buildOptions(track),
        // stderr em 'pipe' para podermos diagnosticar falhas do yt-dlp;
        // windowsHide impede que a janela de console apareça no Windows.
        { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
      );

      const stream = subprocess.stdout;
      if (!stream) {
        subprocess.kill('SIGKILL');
        throw new Error('yt-dlp não produziu stream de áudio.');
      }

      this.attachDiagnostics(subprocess, track);

      // Encerra o yt-dlp quando o stream fecha, evitando processos órfãos.
      stream.once('close', () => {
        if (!subprocess.killed) {
          subprocess.kill('SIGKILL');
        }
      });

      return { stream, type: AudioStreamType.Arbitrary };
    } catch (error) {
      throw new StreamResolutionError(
        `Não foi possível obter o áudio de "${track.title}": ${(error as Error).message}`,
      );
    }
  }

  /**
   * Coleta o stderr do yt-dlp e o registra caso o processo termine com erro.
   * Antes, esse erro era silenciosamente engolido, escondendo a causa real de
   * faixas que "tocavam" mas não emitiam áudio.
   */
  private attachDiagnostics(
    subprocess: ReturnType<typeof youtubedl.exec>,
    track: Track,
  ): void {
    let stderrTail = '';
    subprocess.stderr?.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-STDERR_TAIL_LIMIT);
    });

    // Trata a rejeição do processo (saída != 0) logando — sem mais engolir.
    subprocess.catch((error: Error) => {
      const detail = stderrTail.trim();
      this.logger.warn('yt-dlp encerrou com erro ao transmitir áudio', {
        title: track.title,
        source: track.source,
        error: error.message,
        ...(detail ? { stderr: detail } : {}),
      });
    });
  }

  /**
   * Monta as flags do yt-dlp conforme a faixa. Lives exigem tratamento
   * distinto (Open/Closed: a variação vive aqui, não espalhada pelo resolve):
   *
   * - Áudio da live é servido via HLS (m3u8), sem faixa webm — por isso o
   *   seletor é `bestaudio/best` (sem preferir webm, que nunca casa em live).
   * - `--hls-use-mpegts` faz o yt-dlp emitir um fluxo MPEG-TS contínuo em vez
   *   de um MP4 fragmentado (não streamável). Isso permite ao ffmpeg do
   *   @discordjs/voice consumir o pipe indefinidamente, com o áudio começando
   *   na borda ao vivo (padrão do yt-dlp).
   *
   * `ffmpegLocation` é essencial para HLS: o yt-dlp usa o ffmpeg para baixar
   * e remuxar os segmentos m3u8. Como ele só procura o ffmpeg no PATH do
   * sistema, sem esta flag a live falha com "m3u8 detected but ffmpeg could
   * not be found" e sai muda. É inofensiva para downloads progressivos.
   *
   * A flag booleana só entra quando true: o youtube-dl-exec transforma
   * `false` na variante negada da flag (`--no-...`), que aqui seria inválida.
   */
  private buildOptions(track: Track): Record<string, unknown> {
    const base = {
      output: '-',
      quiet: true,
      noWarnings: true,
      noPlaylist: true,
      ...(this.ffmpegPath ? { ffmpegLocation: this.ffmpegPath } : {}),
    };
    if (track.isLive) {
      return { ...base, format: 'bestaudio/best', hlsUseMpegts: true };
    }
    return { ...base, format: 'bestaudio[ext=webm]/bestaudio/best' };
  }

  /** YouTube e SoundCloud usam a URL; Spotify vira busca no YouTube. */
  private buildTarget(track: Track): string {
    if (track.source === SourceType.Spotify) {
      return `ytsearch1:${track.title} ${track.author}`.trim();
    }
    return track.url;
  }
}

import youtubedl from 'youtube-dl-exec';
import { IStreamResolver } from '../../core/interfaces/IStreamResolver';
import { AudioStream, AudioStreamType, SourceType, Track } from '../../core/types';
import { StreamResolutionError } from '../../core/errors';

/**
 * Resolve o áudio usando o yt-dlp (via youtube-dl-exec).
 *
 * O yt-dlp é o extrator mais robusto e atualizado para YouTube/SoundCloud —
 * onde as bibliotecas em JS puro (play-dl, ytdl-core) falham com 403 em 2026.
 * O processo escreve o melhor áudio em stdout, que entregamos ao
 * @discordjs/voice (o ffmpeg transcodifica). Tudo atrás de IStreamResolver.
 */
export class YtDlpStreamResolver implements IStreamResolver {
  async resolve(track: Track): Promise<AudioStream> {
    const target = this.buildTarget(track);
    try {
      const subprocess = youtubedl.exec(
        target,
        {
          output: '-',
          format: 'bestaudio[ext=webm]/bestaudio/best',
          quiet: true,
          noWarnings: true,
          noPlaylist: true,
        },
        { stdio: ['ignore', 'pipe', 'ignore'] },
      );

      const stream = subprocess.stdout;
      if (!stream) {
        subprocess.kill('SIGKILL');
        throw new Error('yt-dlp não produziu stream de áudio.');
      }

      // Evita "unhandled rejection" quando o processo é encerrado ao pular/parar.
      subprocess.catch(() => undefined);
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

  /** YouTube e SoundCloud usam a URL; Spotify vira busca no YouTube. */
  private buildTarget(track: Track): string {
    if (track.source === SourceType.Spotify) {
      return `ytsearch1:${track.title} ${track.author}`.trim();
    }
    return track.url;
  }
}

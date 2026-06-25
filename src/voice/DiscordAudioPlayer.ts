import { Readable } from 'stream';
import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnection,
} from '@discordjs/voice';
import { IAudioPlayer } from '../core/interfaces/IAudioPlayer';
import { ILogger } from '../core/interfaces/ILogger';
import { AudioStream, AudioStreamType } from '../core/types';

/** Converte o nosso AudioStreamType no StreamType do @discordjs/voice. */
const TO_DISCORD_STREAM_TYPE: Record<AudioStreamType, StreamType> = {
  [AudioStreamType.Arbitrary]: StreamType.Arbitrary,
  [AudioStreamType.Raw]: StreamType.Raw,
  [AudioStreamType.Opus]: StreamType.Opus,
  [AudioStreamType.OggOpus]: StreamType.OggOpus,
  [AudioStreamType.WebmOpus]: StreamType.WebmOpus,
};

/**
 * Adapter concreto de IAudioPlayer sobre @discordjs/voice.
 * Toda a dependência da biblioteca de voz fica confinada nesta classe.
 */
export class DiscordAudioPlayer implements IAudioPlayer {
  private readonly player: AudioPlayer;
  private currentResource: AudioResource | null = null;

  constructor(
    private readonly connection: VoiceConnection,
    private readonly logger: ILogger,
  ) {
    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    this.connection.subscribe(this.player);
    this.observePlayer();
  }

  play(audio: AudioStream): void {
    const resource = createAudioResource(audio.stream as Readable, {
      inputType: TO_DISCORD_STREAM_TYPE[audio.type],
      inlineVolume: true,
    });
    this.currentResource = resource;
    this.player.play(resource);
  }

  stop(): void {
    this.player.stop(true);
  }

  pause(): boolean {
    return this.player.pause();
  }

  unpause(): boolean {
    return this.player.unpause();
  }

  setVolume(volume: number): void {
    this.currentResource?.volume?.setVolume(volume);
  }

  onIdle(listener: () => void): void {
    this.player.on(AudioPlayerStatus.Idle, listener);
  }

  onError(listener: (error: Error) => void): void {
    this.player.on('error', (error) => listener(error));
  }

  destroy(): void {
    this.player.stop(true);
    if (this.connection.state.status !== 'destroyed') {
      this.connection.destroy();
    }
  }

  /**
   * Loga as transições do player. Ao voltar para Idle, registra quantos
   * milissegundos de áudio realmente tocaram (`playbackDuration`): um valor
   * baixo após um "tocando agora" denuncia stream que morreu no início.
   */
  private observePlayer(): void {
    this.player.on('stateChange', (oldState, newState) => {
      this.logger.debug('Player: transição de estado', {
        from: oldState.status,
        to: newState.status,
      });

      if (
        newState.status === AudioPlayerStatus.Idle &&
        oldState.status === AudioPlayerStatus.Playing
      ) {
        this.logger.info('Player: faixa finalizada', {
          playbackMs: this.currentResource?.playbackDuration ?? 0,
        });
      }
    });
  }
}

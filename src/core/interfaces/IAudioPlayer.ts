import { AudioStream } from '../types';

/**
 * Abstração de um player de áudio ligado a um canal de voz.
 *
 * Esconde @discordjs/voice das camadas de serviço (Dependency Inversion),
 * o que torna o GuildMusicService testável com um fake player.
 */
export interface IAudioPlayer {
  /** Inicia a reprodução do stream informado. */
  play(audio: AudioStream): void;
  /** Para a reprodução atual (não destrói a conexão). */
  stop(): void;
  /** Pausa; retorna false se não havia nada tocando. */
  pause(): boolean;
  /** Retoma; retorna false se não estava pausado. */
  unpause(): boolean;
  /** Ajusta o volume (0.0–2.0) quando suportado. */
  setVolume(volume: number): void;
  /** Registra callback disparado quando a faixa termina (player ocioso). */
  onIdle(listener: () => void): void;
  /** Registra callback de erro de reprodução. */
  onError(listener: (error: Error) => void): void;
  /** Encerra player e conexão de voz, liberando recursos. */
  destroy(): void;
}

/** Identificação de um canal de voz para conexão. */
export interface VoiceChannelRef {
  readonly guildId: string;
  readonly channelId: string;
}

/**
 * Factory de conexões de voz (Abstract Factory). A implementação concreta
 * (DiscordVoiceConnector) cria um IAudioPlayer ligado ao canal; os testes
 * injetam um fake.
 */
export interface IVoiceConnector {
  connect(ref: VoiceChannelRef): IAudioPlayer;
}

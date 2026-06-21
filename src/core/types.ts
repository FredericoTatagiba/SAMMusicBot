/**
 * Tipos centrais do domínio. Não dependem de nenhuma biblioteca externa
 * (Discord, play-dl, etc.) — respeitando o Dependency Inversion Principle:
 * as camadas internas não conhecem detalhes de infraestrutura.
 */

/** Plataformas de streaming suportadas. */
export enum SourceType {
  YouTube = 'youtube',
  Spotify = 'spotify',
  SoundCloud = 'soundcloud',
}

/** Formatos de stream de áudio, desacoplados de @discordjs/voice. */
export enum AudioStreamType {
  Arbitrary = 'arbitrary',
  Opus = 'opus',
  Raw = 'raw',
  OggOpus = 'ogg/opus',
  WebmOpus = 'webm/opus',
}

/**
 * Representa uma faixa resolvida a partir de qualquer fonte.
 * É um value object imutável (à exceção de quem requisitou, preenchido depois).
 */
export interface Track {
  /** Identificador único na fonte de origem. */
  readonly id: string;
  readonly title: string;
  readonly author: string;
  /** Duração em milissegundos (0 quando desconhecida, ex.: lives). */
  readonly durationMs: number;
  /** URL canônica da faixa na fonte de origem. */
  readonly url: string;
  readonly source: SourceType;
  readonly thumbnailUrl?: string;
  /** ID do usuário do Discord que requisitou a faixa. */
  requestedById?: string;
}

/** Stream de áudio pronto para reprodução. */
export interface AudioStream {
  readonly stream: NodeJS.ReadableStream;
  readonly type: AudioStreamType;
}

/** Modos de repetição da fila. */
export enum LoopMode {
  Off = 'off',
  Track = 'track',
  Queue = 'queue',
}

/** Níveis de log suportados, em ordem crescente de severidade. */
export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

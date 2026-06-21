/**
 * Abstração de logging (Dependency Inversion). Os serviços dependem desta
 * interface, nunca de uma implementação concreta (console, pino, etc.).
 */
export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  /** Cria um logger filho com contexto adicional (ex.: guildId). */
  child(context: Record<string, unknown>): ILogger;
}

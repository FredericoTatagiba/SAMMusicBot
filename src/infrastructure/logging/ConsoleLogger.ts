import { ILogger } from '../../core/interfaces/ILogger';
import { LogLevel } from '../../core/types';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  [LogLevel.Debug]: 10,
  [LogLevel.Info]: 20,
  [LogLevel.Warn]: 30,
  [LogLevel.Error]: 40,
};

/**
 * Implementação de ILogger baseada em console, com filtro por nível e
 * contexto encadeável. Sem dependências externas para manter o footprint
 * pequeno; trocável por pino/winston sem afetar o resto do código.
 */
export class ConsoleLogger implements ILogger {
  constructor(
    private readonly minLevel: LogLevel = LogLevel.Info,
    private readonly context: Record<string, unknown> = {},
  ) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.Debug, message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.Info, message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.Warn, message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log(LogLevel.Error, message, meta);
  }

  child(context: Record<string, unknown>): ILogger {
    return new ConsoleLogger(this.minLevel, { ...this.context, ...context });
  }

  private log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.minLevel]) {
      return;
    }
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...meta,
    };
    const line = JSON.stringify(payload);
    if (level === LogLevel.Error) {
      console.error(line);
    } else if (level === LogLevel.Warn) {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}

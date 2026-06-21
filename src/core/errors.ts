/**
 * Hierarquia de erros do domínio. Permite tratamento específico
 * sem acoplar as camadas a mensagens de string soltas.
 */

/** Erro base de todo o domínio do bot. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Configuração inválida ou ausente (ex.: token não definido). */
export class ConfigurationError extends DomainError {}

/** Nenhuma faixa encontrada para a busca informada. */
export class TrackNotFoundError extends DomainError {
  constructor(query: string) {
    super(`Nenhuma faixa encontrada para: "${query}".`);
  }
}

/** A fila atingiu o limite máximo configurado. */
export class QueueLimitExceededError extends DomainError {
  constructor(limit: number) {
    super(`A fila atingiu o limite de ${limit} faixas.`);
  }
}

/** Falha ao resolver o stream de áudio de uma faixa. */
export class StreamResolutionError extends DomainError {}

/** Erro de uso de um comando (entrada inválida do usuário). */
export class CommandError extends DomainError {}

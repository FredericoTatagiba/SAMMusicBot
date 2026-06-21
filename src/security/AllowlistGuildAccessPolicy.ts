import { IGuildAccessPolicy } from '../core/interfaces/IGuildAccessPolicy';

/**
 * Allowlist de servidores: o bot só atende os guildIds configurados.
 *
 * Regra: lista vazia = sem restrição (atende qualquer servidor, comportamento
 * padrão). Com um ou mais IDs, apenas esses são atendidos — qualquer outro é
 * ignorado e o bot sai automaticamente dele (ver GuildGuard).
 */
export class AllowlistGuildAccessPolicy implements IGuildAccessPolicy {
  private readonly allowed: ReadonlySet<string>;

  constructor(allowedGuildIds: readonly string[]) {
    this.allowed = new Set(allowedGuildIds);
  }

  isAllowed(guildId: string): boolean {
    return this.allowed.size === 0 || this.allowed.has(guildId);
  }

  get restricted(): boolean {
    return this.allowed.size > 0;
  }
}

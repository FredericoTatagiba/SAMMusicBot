/**
 * Política de acesso por servidor (guild).
 *
 * Decide se o bot deve operar em um determinado servidor. Mantida como
 * interface (Dependency Inversion) para permitir estratégias diferentes
 * — allowlist, blocklist, baseada em banco, etc. — sem mudar os consumidores.
 */
export interface IGuildAccessPolicy {
  isAllowed(guildId: string): boolean;
  /** true quando há restrição ativa (allowlist não vazia). */
  readonly restricted: boolean;
}

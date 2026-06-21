import { ICommand } from '../core/interfaces/ICommand';

/**
 * Registro central de comandos (parte do Command pattern).
 *
 * Indexa comandos por nome e por aliases, garantindo unicidade. O dispatcher
 * resolve a entrada do usuário aqui; o comando de ajuda lista os comandos.
 */
export class CommandRegistry {
  private readonly byKey = new Map<string, ICommand>();

  register(command: ICommand): this {
    this.assertAvailable(command.name);
    this.byKey.set(command.name, command);
    for (const alias of command.aliases) {
      this.assertAvailable(alias);
      this.byKey.set(alias, command);
    }
    return this;
  }

  /** Resolve um nome/alias (case-insensitive) para o comando, ou null. */
  resolve(nameOrAlias: string): ICommand | null {
    return this.byKey.get(nameOrAlias.toLowerCase()) ?? null;
  }

  /** Lista de comandos distintos (sem repetir por alias). */
  all(): readonly ICommand[] {
    return [...new Set(this.byKey.values())];
  }

  private assertAvailable(key: string): void {
    if (this.byKey.has(key)) {
      throw new Error(`Nome/alias de comando duplicado: "${key}".`);
    }
  }
}

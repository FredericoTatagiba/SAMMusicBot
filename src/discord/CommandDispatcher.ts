import { ICommandContext } from '../core/interfaces/ICommand';
import { ILogger } from '../core/interfaces/ILogger';
import { DomainError } from '../core/errors';
import { CommandRegistry } from '../commands/CommandRegistry';

/**
 * Resolve e executa comandos, centralizando o tratamento de erros.
 *
 * Erros de domínio (DomainError) viram mensagens amigáveis ao usuário;
 * erros inesperados são logados e respondidos genericamente. Manter isso
 * aqui mantém cada comando focado só na sua regra (SRP).
 */
export class CommandDispatcher {
  constructor(
    private readonly registry: CommandRegistry,
    private readonly logger: ILogger,
  ) {}

  async dispatch(commandName: string, context: ICommandContext): Promise<void> {
    const command = this.registry.resolve(commandName);
    if (!command) {
      return; // entrada não é um comando conhecido — ignora silenciosamente.
    }
    try {
      await command.execute(context);
    } catch (error) {
      if (error instanceof DomainError) {
        await context.reply(`❌ ${error.message}`);
        return;
      }
      this.logger.error('Erro inesperado ao executar comando', {
        command: commandName,
        error: (error as Error).message,
      });
      await context.reply('⚠️ Ocorreu um erro inesperado ao executar o comando.');
    }
  }
}

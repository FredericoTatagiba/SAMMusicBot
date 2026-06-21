import { ICommand, ICommandContext } from '../core/interfaces/ICommand';
import { CommandRegistry } from './CommandRegistry';

/** Lista todos os comandos disponíveis. */
export class HelpCommand implements ICommand {
  readonly name = 'help';
  readonly aliases = ['h', 'ajuda', 'comandos'] as const;
  readonly description = 'Mostra a lista de comandos.';
  readonly usage = '!help';

  constructor(
    private readonly registry: CommandRegistry,
    private readonly prefix: string,
  ) {}

  async execute(ctx: ICommandContext): Promise<void> {
    const lines = this.registry
      .all()
      .map((cmd) => `\`${this.prefix}${cmd.name}\` — ${cmd.description}`);
    await ctx.reply(['🎵 **Comandos disponíveis:**', ...lines].join('\n'));
  }
}

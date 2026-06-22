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
    const lines = this.registry.all().map((cmd) => this.formatLine(cmd));
    await ctx.reply(['🎵 **Comandos disponíveis:**', ...lines].join('\n'));
  }

  /** Monta a linha do comando com seus atalhos (aliases), se houver. */
  private formatLine(cmd: ICommand): string {
    const name = `\`${this.prefix}${cmd.name}\``;
    const aliases =
      cmd.aliases.length > 0
        ? ` _(${cmd.aliases.map((a) => `${this.prefix}${a}`).join(', ')})_`
        : '';
    return `${name}${aliases} — ${cmd.description}`;
  }
}

import { ICommand, ICommandContext } from '../core/interfaces/ICommand';
import { CommandRegistry } from './CommandRegistry';

/** Lista todos os comandos disponíveis. */
export class HelpCommand implements ICommand {
  readonly name = 'help';
  readonly aliases = ['h', 'ajuda', 'comandos'] as const;
  readonly description = 'Mostra esta lista de comandos e como usar cada um.';
  readonly usage = '';

  constructor(
    private readonly registry: CommandRegistry,
    private readonly prefix: string,
  ) {}

  async execute(ctx: ICommandContext): Promise<void> {
    const lines = this.registry.all().map((cmd) => this.formatLine(cmd));
    await ctx.reply(['🎵 **Comandos disponíveis:**', ...lines].join('\n'));
  }

  /** Monta o bloco do comando: nome, atalhos, descrição e exemplo de uso. */
  private formatLine(cmd: ICommand): string {
    const name = `\`${this.prefix}${cmd.name}\``;
    const aliases =
      cmd.aliases.length > 0
        ? ` _(${cmd.aliases.map((a) => `${this.prefix}${a}`).join(', ')})_`
        : '';
    const usage = cmd.usage
      ? `\n   ↳ uso: \`${this.prefix}${cmd.name} ${cmd.usage}\``
      : '';
    return `${name}${aliases} — ${cmd.description}${usage}`;
  }
}

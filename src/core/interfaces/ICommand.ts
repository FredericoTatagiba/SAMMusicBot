/**
 * Command pattern desacoplado do Discord.
 *
 * Os comandos dependem de ICommandContext (uma abstração), não de
 * `Message`/`Interaction` do discord.js. Isso mantém a lógica testável e
 * respeita o Interface Segregation Principle: o comando só enxerga o que
 * precisa (args, quem chamou, canal de voz e um meio de responder).
 */
export interface ICommandContext {
  readonly guildId: string;
  readonly userId: string;
  /** Argumentos já tokenizados (sem o nome do comando). */
  readonly args: string[];
  /** Canal de voz em que o usuário está, ou null se não estiver em nenhum. */
  readonly voiceChannelId: string | null;
  /** Envia uma resposta textual ao canal de origem. */
  reply(message: string): Promise<void>;
}

export interface ICommand {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly description: string;
  /** Argumentos do comando (sem prefixo/nome); vazio quando não há. */
  readonly usage: string;
  execute(context: ICommandContext): Promise<void>;
}

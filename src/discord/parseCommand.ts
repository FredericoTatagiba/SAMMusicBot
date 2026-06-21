export interface ParsedCommand {
  readonly name: string;
  readonly args: string[];
}

/**
 * Faz o parse puro de uma mensagem em comando + argumentos.
 * Função sem efeitos colaterais — fácil de testar isoladamente.
 *
 * @returns null quando a mensagem não começa com o prefixo ou está vazia.
 */
export function parseCommand(
  content: string,
  prefix: string,
): ParsedCommand | null {
  if (prefix.length === 0 || !content.startsWith(prefix)) {
    return null;
  }
  const body = content.slice(prefix.length).trim();
  if (body.length === 0) {
    return null;
  }
  const tokens = body.split(/\s+/);
  const name = tokens.shift()!.toLowerCase();
  return { name, args: tokens };
}

import { parseCommand } from '../discord/parseCommand';

/** Ação de rádio já interpretada a partir da mensagem. */
export type RadioAction =
  | { readonly kind: 'help' }
  | { readonly kind: 'stop' }
  | { readonly kind: 'search'; readonly query: string }
  | { readonly kind: 'lookup'; readonly query: string };

const STOP_WORDS = new Set(['parar', 'p', 'stop', 'sair']);
const SEARCH_WORDS = new Set(['buscar', 'b', 'search', 'procurar']);

/**
 * Parser puro dos comandos de rádio. Reaproveita o `parseCommand` (prefixo +
 * tokens) e só reage a `radio`/`r`. Decide entre ajuda, parar (`parar`/`p`),
 * busca livre (`buscar`/`b <termo>`) e o lookup híbrido (qualquer outro texto
 * = país/termo).
 *
 * @returns null quando a mensagem não é um comando de rádio.
 */
export function parseRadioCommand(
  content: string,
  prefix: string,
): RadioAction | null {
  const parsed = parseCommand(content, prefix);
  if (!parsed || (parsed.name !== 'radio' && parsed.name !== 'r')) {
    return null;
  }
  const [sub, ...rest] = parsed.args;
  if (!sub) {
    return { kind: 'help' };
  }
  const lower = sub.toLowerCase();
  if (STOP_WORDS.has(lower)) {
    return { kind: 'stop' };
  }
  if (SEARCH_WORDS.has(lower)) {
    const query = rest.join(' ').trim();
    return query ? { kind: 'search', query } : { kind: 'help' };
  }
  return { kind: 'lookup', query: parsed.args.join(' ').trim() };
}

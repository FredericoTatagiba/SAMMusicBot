import { LoopMode, Track } from '../core/types';
import { QueueLimitExceededError } from '../core/errors';

/**
 * Fila de reprodução de um servidor. Lógica pura, sem dependências de
 * Discord ou áudio — 100% testável por unidade.
 *
 * Responsabilidade única (SRP): manter a ordem das faixas, a faixa atual e
 * o modo de repetição. Não toca, não conecta, não busca.
 */
export class MusicQueue {
  private readonly items: Track[] = [];
  private current: Track | null = null;
  private loopMode: LoopMode = LoopMode.Off;

  constructor(private readonly maxSize: number = 200) {}

  /** Adiciona uma faixa ao fim da fila. */
  add(track: Track): void {
    if (this.items.length >= this.maxSize) {
      throw new QueueLimitExceededError(this.maxSize);
    }
    this.items.push(track);
  }

  /** Adiciona várias faixas; respeita o limite de forma atômica. */
  addMany(tracks: readonly Track[]): void {
    if (this.items.length + tracks.length > this.maxSize) {
      throw new QueueLimitExceededError(this.maxSize);
    }
    this.items.push(...tracks);
  }

  /**
   * Avança para a próxima faixa conforme o modo de repetição e a define
   * como atual. Retorna a nova faixa atual, ou null se a fila esvaziou.
   */
  next(): Track | null {
    if (this.loopMode === LoopMode.Track && this.current) {
      return this.current;
    }
    if (this.loopMode === LoopMode.Queue && this.current) {
      this.items.push(this.current);
    }
    this.current = this.items.shift() ?? null;
    return this.current;
  }

  /** Faixa em reprodução no momento. */
  getCurrent(): Track | null {
    return this.current;
  }

  /** Cópia somente-leitura das faixas pendentes (sem a atual). */
  getUpcoming(): readonly Track[] {
    return [...this.items];
  }

  /** Remove uma faixa pendente pela posição (base 0). Retorna a removida. */
  remove(index: number): Track | null {
    if (index < 0 || index >= this.items.length) {
      return null;
    }
    return this.items.splice(index, 1)[0] ?? null;
  }

  /** Embaralha as faixas pendentes (Fisher–Yates). */
  shuffle(): void {
    for (let i = this.items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.items[i], this.items[j]] = [this.items[j]!, this.items[i]!];
    }
  }

  /** Limpa a fila e a faixa atual. */
  clear(): void {
    this.items.length = 0;
    this.current = null;
  }

  setLoopMode(mode: LoopMode): void {
    this.loopMode = mode;
  }

  getLoopMode(): LoopMode {
    return this.loopMode;
  }

  /** Quantidade de faixas pendentes (não inclui a atual). */
  get size(): number {
    return this.items.length;
  }

  /** Verdadeiro quando não há faixa atual nem pendentes. */
  get isEmpty(): boolean {
    return this.items.length === 0 && this.current === null;
  }
}

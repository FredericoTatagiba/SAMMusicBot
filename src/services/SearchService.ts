import { ISourceProvider } from '../core/interfaces/ISourceProvider';
import { ILogger } from '../core/interfaces/ILogger';
import { Track } from '../core/types';
import { TrackNotFoundError } from '../core/errors';

/**
 * Orquestrador de busca (Strategy + Chain of Responsibility).
 *
 * Recebe uma lista de providers e delega a resolução ao primeiro que
 * declara `supports(query)`. Quando nenhum reconhece a entrada (ex.: busca
 * textual livre), usa o provider padrão (fallback) — normalmente o YouTube.
 *
 * Open/Closed: adicionar uma nova fonte é registrar mais um provider,
 * sem tocar nesta classe.
 */
export class SearchService {
  constructor(
    private readonly providers: readonly ISourceProvider[],
    private readonly fallback: ISourceProvider,
    private readonly logger: ILogger,
  ) {
    if (providers.length === 0) {
      throw new Error('SearchService requer ao menos um provider.');
    }
  }

  /**
   * Resolve a consulta em uma ou mais faixas.
   * @throws TrackNotFoundError quando a consulta é vazia ou nada é encontrado.
   */
  async search(query: string): Promise<Track[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      throw new TrackNotFoundError(query);
    }

    const provider = this.selectProvider(trimmed);
    this.logger.debug('Resolvendo busca', {
      query: trimmed,
      provider: provider.source,
    });

    const tracks = await provider.resolve(trimmed);
    if (tracks.length === 0) {
      throw new TrackNotFoundError(trimmed);
    }
    return tracks;
  }

  private selectProvider(query: string): ISourceProvider {
    return this.providers.find((p) => p.supports(query)) ?? this.fallback;
  }
}

import { ILogger } from '../core/interfaces/ILogger';
import { IRadioDirectory } from './IRadioDirectory';
import {
  RadioHitType,
  RadioPlaceRef,
  RadioPlaceView,
  RadioSearchHit,
  RadioStation,
} from './types';

/** Contrato mínimo de fetch — satisfeito pelo `fetch` global e por fakes. */
export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}
export type HttpFetch = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<HttpResponse>;

/** UA "de navegador": o Radio Garden rejeita alguns clientes sem isto. */
const USER_AGENT =
  'Mozilla/5.0 (compatible; DiscordMusicBot/1.0; +https://github.com/)';

/**
 * Cliente do Radio Garden. Traduz as respostas cruas da API nos tipos
 * normalizados do módulo. A API real aninha os dados em `page` (canais,
 * lugares e países); o parsing aqui é tolerante e cai para o formato plano
 * quando `page` não existe. Toda a rede fica confinada nesta classe.
 */
export class RadioGardenClient implements IRadioDirectory {
  constructor(
    private readonly baseUrl: string,
    private readonly logger: ILogger,
    private readonly fetchFn: HttpFetch = fetch,
  ) {}

  async search(query: string): Promise<readonly RadioSearchHit[]> {
    const raw = await this.getJson<RawSearch>(
      `/search?q=${encodeURIComponent(query)}`,
    );
    const hits: RadioSearchHit[] = [];
    for (const hit of raw.hits?.hits ?? []) {
      const source = hit?._source;
      if (!source) {
        continue;
      }
      const node = source.page ?? source;
      const url = node.url ?? node.href;
      const title = node.title;
      if (!url || !title) {
        continue;
      }
      hits.push({
        type: normalizeType(source.type ?? node.type),
        title,
        subtitle: node.subtitle,
        id: node.map ?? idFromPath(url),
      });
    }
    return hits;
  }

  async getPlace(placeId: string): Promise<RadioPlaceView> {
    const raw = await this.getJson<RawPageResponse>(
      `/ara/content/page/${encodeURIComponent(placeId)}`,
    );
    const data = raw.data ?? {};
    const stations = new Map<string, RadioStation>();
    const cities = new Map<string, RadioPlaceRef>();

    for (const section of data.content ?? []) {
      const isChannelList = section?.itemsType === 'channel';
      for (const item of section?.items ?? []) {
        if (isChannelList) {
          const station = stationFromNode(item);
          if (station && !stations.has(station.channelId)) {
            stations.set(station.channelId, station);
          }
        } else {
          const city = placeFromNode(item);
          if (city && !cities.has(city.placeId)) {
            cities.set(city.placeId, city);
          }
        }
      }
    }

    return {
      placeId,
      title: data.title ?? '',
      stations: [...stations.values()],
      cities: [...cities.values()],
    };
  }

  async getPlaceChannels(placeId: string): Promise<readonly RadioStation[]> {
    const raw = await this.getJson<RawPageResponse>(
      `/ara/content/page/${encodeURIComponent(placeId)}/channels`,
    );
    const stations: RadioStation[] = [];
    for (const section of raw.data?.content ?? []) {
      for (const item of section?.items ?? []) {
        const station = stationFromNode(item);
        if (station) {
          stations.push(station);
        }
      }
    }
    return stations;
  }

  async getChannel(channelId: string): Promise<RadioStation> {
    const raw = await this.getJson<RawChannelResponse>(
      `/ara/content/channel/${encodeURIComponent(channelId)}`,
    );
    const data = raw.data ?? {};
    const parts = [data.place?.title, data.country?.title].filter(
      (part): part is string => Boolean(part),
    );
    return {
      channelId,
      title: data.title ?? channelId,
      subtitle: parts.length > 0 ? parts.join(', ') : undefined,
    };
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    });
    if (!response.ok) {
      this.logger.warn('Radio Garden respondeu com erro', {
        path,
        status: response.status,
      });
      throw new Error(`Radio Garden respondeu HTTP ${response.status}.`);
    }
    return (await response.json()) as T;
  }
}

/** Estação a partir de um nó de item (aninhado em `page` ou plano). */
function stationFromNode(item: RawNode | undefined): RadioStation | null {
  const node = item?.page ?? item;
  const url = node?.url ?? node?.href;
  const title = node?.title ?? item?.title;
  if (!url || !title) {
    return null;
  }
  const channelId = idFromPath(url);
  return channelId ? { channelId, title, subtitle: node?.subtitle } : null;
}

/** Cidade/lugar a partir de um nó de item. */
function placeFromNode(item: RawNode | undefined): RadioPlaceRef | null {
  const node = item?.page ?? item;
  const placeId = node?.map ?? (node?.url ? idFromPath(node.url) : undefined);
  const title = item?.title ?? node?.title;
  if (!placeId || !title) {
    return null;
  }
  return {
    placeId,
    title,
    count: item?.leftAccessoryCount ?? node?.count,
  };
}

/** Extrai o ID final de um caminho tipo `/listen/slug/ID` ou `/visit/slug/ID`. */
function idFromPath(path: string): string {
  const parts = path
    .split('/')
    .filter((part) => part.length > 0 && part !== 'channels');
  return parts[parts.length - 1] ?? '';
}

/** Mapeia o `type` cru para o nosso tipo restrito. */
function normalizeType(type: string | undefined): RadioHitType {
  if (type === 'channel') {
    return 'channel';
  }
  if (type === 'country') {
    return 'country';
  }
  return 'place';
}

/* ----------------------------- formas cruas ----------------------------- */

/** Nó genérico e tolerante: os campos aparecem em `_source`/`item` ou em `.page`. */
interface RawNode {
  type?: string;
  url?: string;
  href?: string;
  title?: string;
  subtitle?: string;
  map?: string;
  count?: number;
  leftAccessoryCount?: number;
  itemsType?: string;
  page?: RawNode;
  items?: Array<RawNode | undefined>;
  content?: Array<RawNode | undefined>;
}
interface RawSearch {
  hits?: { hits?: Array<{ _source?: RawNode } | undefined> };
}
interface RawPageResponse {
  data?: RawNode;
}
interface RawChannelResponse {
  data?: {
    title?: string;
    place?: { title?: string };
    country?: { title?: string };
  };
}

import { HttpFetch, RadioGardenClient } from '../../src/radio/RadioGardenClient';
import { NullLogger } from '../helpers/fakes';

const BASE = 'https://radio.garden/api';

/** fetch fake que casa a primeira rota cujo trecho aparece na URL. */
function fetchReturning(routes: Array<{ match: string; body: unknown }>): HttpFetch {
  return async (url) => {
    const route = routes.find((item) => url.includes(item.match));
    if (!route) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => route.body };
  };
}

function client(routes: Array<{ match: string; body: unknown }>): RadioGardenClient {
  return new RadioGardenClient(BASE, new NullLogger(), fetchReturning(routes));
}

describe('RadioGardenClient', () => {
  // A API real aninha os dados em `_source.page` — canal, país e cidade.
  it('normaliza a busca lendo os campos aninhados em page', async () => {
    const hits = await client([
      {
        match: '/search',
        body: {
          hits: {
            hits: [
              {
                _source: {
                  type: 'channel',
                  page: {
                    type: 'channel',
                    url: '/listen/kutx/vbFsCngB',
                    title: 'KUTX',
                    subtitle: 'Austin TX, United States',
                  },
                },
              },
              {
                _source: {
                  type: 'country',
                  page: { type: 'page', url: '/visit/brazil/GhDXw4EW', title: 'Brazil' },
                },
              },
              {
                _source: {
                  type: 'place',
                  page: {
                    type: 'page',
                    map: 'BMplqTGe',
                    url: '/visit/sao-paulo-sp/BMplqTGe',
                    title: 'São Paulo SP',
                    subtitle: 'Brazil',
                    count: 200,
                  },
                },
              },
            ],
          },
        },
      },
    ]).search('kutx');

    expect(hits).toEqual([
      { type: 'channel', title: 'KUTX', subtitle: 'Austin TX, United States', id: 'vbFsCngB' },
      { type: 'country', title: 'Brazil', id: 'GhDXw4EW' },
      { type: 'place', title: 'São Paulo SP', subtitle: 'Brazil', id: 'BMplqTGe' },
    ]);
  });

  it('também entende a busca no formato plano (tolerância)', async () => {
    const hits = await client([
      {
        match: '/search',
        body: {
          hits: {
            hits: [
              { _source: { type: 'channel', url: '/listen/x/AAA', title: 'Rádio X' } },
            ],
          },
        },
      },
    ]).search('x');
    expect(hits).toEqual([{ type: 'channel', title: 'Rádio X', id: 'AAA' }]);
  });

  it('parseia a página do país: populares (page) e cidades (map)', async () => {
    const view = await client([
      {
        match: '/ara/content/page/',
        body: {
          data: {
            title: 'Brazil',
            content: [
              {
                itemsType: 'channel',
                type: 'list',
                title: 'Popular Stations',
                items: [
                  {
                    page: {
                      url: '/listen/alpha/AAA',
                      title: 'Alpha FM 101.7',
                      subtitle: 'São Paulo SP',
                    },
                  },
                ],
              },
              {
                title: 'Places in Brazil',
                type: 'list',
                items: [
                  {
                    page: { map: 'BMplqTGe', url: '/visit/sp/BMplqTGe', title: 'São Paulo SP' },
                    title: 'São Paulo SP',
                    leftAccessory: 'count',
                    leftAccessoryCount: 208,
                  },
                ],
              },
            ],
          },
        },
      },
    ]).getPlace('Fx52MfoZ');

    expect(view.title).toBe('Brazil');
    expect(view.stations).toEqual([
      { channelId: 'AAA', title: 'Alpha FM 101.7', subtitle: 'São Paulo SP' },
    ]);
    expect(view.cities).toEqual([
      { placeId: 'BMplqTGe', title: 'São Paulo SP', count: 208 },
    ]);
  });

  it('lista as estações de uma cidade (items aninhados em page)', async () => {
    const stations = await client([
      {
        match: '/channels',
        body: {
          data: {
            content: [
              {
                itemsType: 'channel',
                items: [
                  { page: { url: '/listen/a/AAA', title: 'A' } },
                  { page: { url: '/listen/b/BBB', title: 'B' } },
                ],
              },
            ],
          },
        },
      },
    ]).getPlaceChannels('BMplqTGe');

    expect(stations).toEqual([
      { channelId: 'AAA', title: 'A' },
      { channelId: 'BBB', title: 'B' },
    ]);
  });

  it('monta a legenda "Cidade, País" nos detalhes do canal', async () => {
    const station = await client([
      {
        match: '/ara/content/channel/',
        body: {
          data: {
            title: 'KUTX',
            place: { title: 'Austin TX' },
            country: { title: 'United States' },
          },
        },
      },
    ]).getChannel('vbFsCngB');

    expect(station).toEqual({
      channelId: 'vbFsCngB',
      title: 'KUTX',
      subtitle: 'Austin TX, United States',
    });
  });

  it('lança erro quando a API responde falha', async () => {
    const failing = new RadioGardenClient(BASE, new NullLogger(), async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));
    await expect(failing.search('x')).rejects.toThrow();
  });
});

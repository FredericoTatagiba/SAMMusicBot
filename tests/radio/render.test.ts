import {
  renderCountry,
  renderNowPlaying,
  renderStations,
} from '../../src/radio/render';

interface RowJson {
  components: Array<{
    custom_id?: string;
    options?: Array<{ label: string; value: string; description?: string }>;
  }>;
}

describe('render', () => {
  it('monta o menu de estações com o channelId no value', () => {
    const payload = renderStations({
      title: 'Resultados',
      stations: [
        { channelId: 'AAA', title: 'Rádio X', subtitle: 'SP' },
        { channelId: 'BBB', title: 'Rádio Y' },
      ],
      userId: 'U1',
    });

    const row = payload.components[0]!.toJSON() as RowJson;
    expect(row.components[0]!.custom_id).toBe('radio:play:U1');
    expect(row.components[0]!.options?.map((option) => option.value)).toEqual([
      'AAA',
      'BBB',
    ]);
  });

  it('limita o menu a 25 opções', () => {
    const stations = Array.from({ length: 30 }, (_unused, index) => ({
      channelId: `c${index}`,
      title: `t${index}`,
    }));
    const payload = renderStations({ title: 'x', stations, userId: 'U' });
    const row = payload.components[0]!.toJSON() as RowJson;
    expect(row.components[0]!.options).toHaveLength(25);
  });

  it('sem estações não gera menu', () => {
    const payload = renderStations({ title: 'x', stations: [], userId: 'U' });
    expect(payload.components).toHaveLength(0);
  });

  it('país mostra estações e o botão de cidades', () => {
    const payload = renderCountry(
      {
        placeId: 'BR',
        title: 'Brasil',
        stations: [{ channelId: 'AAA', title: 'X' }],
        cities: [{ placeId: 'SP', title: 'São Paulo' }],
      },
      'U9',
    );

    expect(payload.components).toHaveLength(2);
    const buttonRow = payload.components[1]!.toJSON() as RowJson;
    expect(buttonRow.components[0]!.custom_id).toBe('radio:cities:BR:U9');
  });

  it('"tocando agora" traz o botão de parar', () => {
    const payload = renderNowPlaying({
      channelId: 'AAA',
      title: 'X',
      subtitle: 'SP, Brasil',
    });
    const row = payload.components[0]!.toJSON() as RowJson;
    expect(row.components[0]!.custom_id).toBe('radio:stop');
  });
});

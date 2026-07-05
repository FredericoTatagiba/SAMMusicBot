import { RadioService } from '../../src/radio/RadioService';
import { RadioManager } from '../../src/radio/RadioManager';
import { FakeDirectoryData, FakeRadioDirectory, FakeRadioStreamResolver } from './fakes';
import { FakeAudioPlayer, FakeVoiceConnector, NullLogger } from '../helpers/fakes';

function build(dirData: FakeDirectoryData = {}) {
  const directory = new FakeRadioDirectory(dirData);
  const player = new FakeAudioPlayer();
  const connector = new FakeVoiceConnector(player);
  const manager = new RadioManager(
    connector,
    new FakeRadioStreamResolver(),
    new NullLogger(),
  );
  const stoppedMusic: string[] = [];
  const service = new RadioService(directory, manager, new NullLogger(), (id) =>
    stoppedMusic.push(id),
  );
  return { service, directory, player, stoppedMusic };
}

describe('RadioService', () => {
  it('lookup devolve o país quando há hit de país', async () => {
    const { service, directory } = build({
      search: [{ type: 'country', title: 'Brasil', id: 'BR' }],
      place: { placeId: 'BR', title: 'Brasil', stations: [], cities: [] },
    });

    const result = await service.lookup('brasil');

    expect(result.kind).toBe('country');
    expect(directory.placeIds).toContain('BR');
  });

  it('lookup devolve estações quando não casa país', async () => {
    const { service } = build({
      search: [
        { type: 'channel', title: 'X', id: 'AAA' },
        { type: 'place', title: 'Cidade', id: 'P' },
      ],
    });

    const result = await service.lookup('jazz');

    expect(result).toEqual({
      kind: 'stations',
      query: 'jazz',
      stations: [{ channelId: 'AAA', title: 'X' }],
    });
  });

  it('searchStations filtra só canais', async () => {
    const { service } = build({
      search: [
        { type: 'channel', title: 'X', id: 'AAA' },
        { type: 'country', title: 'C', id: 'C1' },
      ],
    });

    expect(await service.searchStations('x')).toEqual([
      { channelId: 'AAA', title: 'X' },
    ]);
  });

  it('play para a música antes e toca a estação no canal', async () => {
    const { service, player, stoppedMusic } = build();

    await service.play('guild-1', 'voice-1', { channelId: 'AAA', title: 'X' });

    expect(stoppedMusic).toEqual(['guild-1']);
    expect(player.playCount).toBe(1);
    expect(service.nowPlaying('guild-1')?.channelId).toBe('AAA');
  });

  it('stop retorna false sem rádio e true depois de tocar', async () => {
    const { service } = build();

    expect(service.stop('guild-1')).toBe(false);
    await service.play('guild-1', 'voice-1', { channelId: 'AAA', title: 'X' });
    expect(service.stop('guild-1')).toBe(true);
  });

  it('queda da conexão de voz descarta a sessão', async () => {
    const { service, player } = build();
    await service.play('guild-1', 'voice-1', { channelId: 'AAA', title: 'X' });

    player.emitDisconnect();

    expect(service.nowPlaying('guild-1')).toBeNull();
  });

  it('lookup abre a cidade quando não há país nem canais', async () => {
    const { service, directory } = build({
      search: [{ type: 'place', title: 'Tóquio', id: 'TKO' }],
      place: { placeId: 'TKO', title: 'Tokyo', stations: [], cities: [] },
    });

    const result = await service.lookup('toquio');

    expect(result.kind).toBe('country');
    expect(directory.placeIds).toContain('TKO');
  });
});

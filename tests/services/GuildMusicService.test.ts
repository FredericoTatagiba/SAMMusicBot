import { GuildMusicService } from '../../src/services/GuildMusicService';
import { MusicQueue } from '../../src/services/MusicQueue';
import {
  FakeAudioPlayer,
  FakeStreamResolver,
  FakeVoiceConnector,
  NullLogger,
  makeTrack,
} from '../helpers/fakes';

function buildService(options: {
  player?: FakeAudioPlayer;
  resolver?: FakeStreamResolver;
  onDispose?: (guildId: string) => void;
} = {}) {
  const player = options.player ?? new FakeAudioPlayer();
  const connector = new FakeVoiceConnector(player);
  const resolver = options.resolver ?? new FakeStreamResolver();
  const queue = new MusicQueue();
  const service = new GuildMusicService(
    'guild-1',
    queue,
    connector,
    resolver,
    new NullLogger(),
    60_000,
    options.onDispose ?? (() => {}),
  );
  return { service, player, connector, queue };
}

describe('GuildMusicService', () => {
  it('conecta e começa a tocar na primeira faixa enfileirada', async () => {
    const { service, player, connector } = buildService();

    const result = await service.enqueue([makeTrack()], 'voice-1', 'user-1');

    expect(connector.connectCount).toBe(1);
    expect(connector.lastRef).toEqual({ guildId: 'guild-1', channelId: 'voice-1' });
    expect(player.playCount).toBe(1);
    expect(result.startedPlayback).toBe(true);
  });

  it('marca o usuário que requisitou a faixa', async () => {
    const { service, queue } = buildService();
    await service.enqueue([makeTrack()], 'voice-1', 'user-42');
    expect(queue.getCurrent()?.requestedById).toBe('user-42');
  });

  it('apenas enfileira quando já está tocando (não reconecta)', async () => {
    const { service, player, connector } = buildService();
    await service.enqueue([makeTrack({ id: 'a' })], 'voice-1', 'u');
    const result = await service.enqueue([makeTrack({ id: 'b' })], 'voice-1', 'u');

    expect(connector.connectCount).toBe(1);
    expect(player.playCount).toBe(1);
    expect(result.startedPlayback).toBe(false);
  });

  it('toca a próxima faixa quando a atual termina (idle)', async () => {
    const { service, player } = buildService();
    await service.enqueue(
      [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })],
      'voice-1',
      'u',
    );
    expect(player.playCount).toBe(1);

    player.emitIdle(); // fim da faixa a
    await Promise.resolve();
    await Promise.resolve();

    expect(player.playCount).toBe(2);
  });

  it('skip para a faixa atual e avança', async () => {
    const { service, player } = buildService();
    await service.enqueue(
      [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })],
      'voice-1',
      'u',
    );
    const skipped = service.skip();
    await Promise.resolve();
    await Promise.resolve();

    expect(skipped).toBe(true);
    expect(player.playCount).toBe(2);
  });

  it('skip retorna false quando nada está tocando', () => {
    const { service } = buildService();
    expect(service.skip()).toBe(false);
  });

  it('pula faixa cujo stream falha sem travar a fila', async () => {
    const resolver = new FakeStreamResolver((t) => t.id === 'a');
    const { service, player } = buildService({ resolver });

    await service.enqueue(
      [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })],
      'voice-1',
      'u',
    );
    await Promise.resolve();
    await Promise.resolve();

    // 'a' falhou; deve ter avançado e tocado 'b'.
    expect(player.playCount).toBe(1);
    expect(player.lastAudio).not.toBeNull();
  });

  it('stop limpa a fila, destrói o player e dispara onDispose', async () => {
    const disposed: string[] = [];
    const { service, player } = buildService({
      onDispose: (id) => disposed.push(id),
    });
    await service.enqueue([makeTrack()], 'voice-1', 'u');

    service.stop();

    expect(player.destroyed).toBe(true);
    expect(disposed).toEqual(['guild-1']);
    expect(service.snapshot().current).toBeNull();
  });

  it('pause/resume delegam ao player', async () => {
    const { service } = buildService();
    await service.enqueue([makeTrack()], 'voice-1', 'u');
    expect(service.pause()).toBe(true);
    expect(service.pause()).toBe(false);
    expect(service.resume()).toBe(true);
    expect(service.resume()).toBe(false);
  });
});

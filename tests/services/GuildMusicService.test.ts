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
  idleMs?: number;
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
    options.idleMs ?? 60_000,
    options.onDispose ?? (() => {}),
  );
  return { service, player, connector, queue };
}

/** Esvazia a fila de microtasks (resoluções de stream + cadeia serial). */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
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
    await flushMicrotasks();

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
    await flushMicrotasks();

    expect(skipped).toBe(true);
    expect(player.playCount).toBe(2);
  });

  it('skip retorna false quando nada está tocando', () => {
    const { service } = buildService();
    expect(service.skip()).toBe(false);
  });

  it('skip pula a faixa atual mesmo sem próxima na fila', async () => {
    const { service, player } = buildService();
    await service.enqueue([makeTrack({ id: 'a' })], 'voice-1', 'u');

    // Há faixa atual ('a'), porém nada pendente: skip deve agir mesmo assim.
    expect(service.skip()).toBe(true);
    await flushMicrotasks();
    expect(player.playCount).toBe(1);
  });

  it('pula faixa cujo stream falha sem travar a fila', async () => {
    const resolver = new FakeStreamResolver((t) => t.id === 'a');
    const { service, player } = buildService({ resolver });

    await service.enqueue(
      [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })],
      'voice-1',
      'u',
    );
    await flushMicrotasks();

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

  it('teardown é idempotente: stop repetido dispara onDispose só uma vez', async () => {
    const disposed: string[] = [];
    const { service } = buildService({ onDispose: (id) => disposed.push(id) });
    await service.enqueue([makeTrack()], 'voice-1', 'u');

    service.stop();
    service.stop();

    expect(disposed).toEqual(['guild-1']);
  });

  it('enfileirar após a fila esvaziar cancela a desconexão por ociosidade (não deixa conexão órfã)', async () => {
    jest.useFakeTimers();
    try {
      const disposed: string[] = [];
      const { service, player } = buildService({
        idleMs: 10_000,
        onDispose: (id) => disposed.push(id),
      });

      await service.enqueue([makeTrack({ id: 'a' })], 'voice-1', 'u');
      expect(player.playCount).toBe(1);

      // Faixa termina e a fila fica vazia: agenda desconexão por ociosidade.
      player.emitIdle();
      await flushMicrotasks();

      // Novo enqueue chega ANTES do timer disparar (a corrida do bug).
      await service.enqueue([makeTrack({ id: 'b' })], 'voice-1', 'u');
      await flushMicrotasks();
      expect(player.playCount).toBe(2);

      // Avança além do idle: o timer antigo não pode destruir a conexão viva.
      jest.advanceTimersByTime(30_000);
      await flushMicrotasks();

      expect(player.destroyed).toBe(false);
      expect(disposed).toEqual([]);
      expect(service.snapshot().current?.id).toBe('b');
    } finally {
      jest.useRealTimers();
    }
  });
});

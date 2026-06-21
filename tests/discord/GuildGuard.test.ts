import { Client, Events, Guild } from 'discord.js';
import { GuildGuard } from '../../src/discord/GuildGuard';
import { AllowlistGuildAccessPolicy } from '../../src/security/AllowlistGuildAccessPolicy';
import { NullLogger } from '../helpers/fakes';

interface FakeGuild {
  id: string;
  name: string;
  leave: jest.Mock;
}

/** Client mínimo com o necessário para o GuildGuard. */
function makeFakeClient(cachedGuilds: FakeGuild[]) {
  const handlers = new Map<string, (arg: unknown) => void>();
  const client = {
    on: (event: string, cb: (arg: unknown) => void) => {
      handlers.set(event, cb);
    },
    once: (event: string, cb: (arg: unknown) => void) => {
      handlers.set(event, cb);
    },
    guilds: { cache: new Map(cachedGuilds.map((g) => [g.id, g])) },
  };
  const emit = (event: string, arg?: unknown): void => {
    handlers.get(event)?.(arg);
  };
  return { client: client as unknown as Client, emit, handlers };
}

function fakeGuild(id: string, name = `guild-${id}`): FakeGuild {
  return { id, name, leave: jest.fn().mockResolvedValue(undefined) };
}

describe('GuildGuard', () => {
  it('não registra nada quando não há restrição', () => {
    const { client, handlers } = makeFakeClient([]);
    const policy = new AllowlistGuildAccessPolicy([]); // vazio = sem restrição
    new GuildGuard(client, policy, new NullLogger()).register();
    expect(handlers.size).toBe(0);
  });

  it('sai de um servidor não autorizado ao ser adicionado', async () => {
    const intruder = fakeGuild('999');
    const { client, emit } = makeFakeClient([]);
    const policy = new AllowlistGuildAccessPolicy(['111']);
    new GuildGuard(client, policy, new NullLogger()).register();

    emit(Events.GuildCreate, intruder as unknown as Guild);
    await Promise.resolve();

    expect(intruder.leave).toHaveBeenCalledTimes(1);
  });

  it('permanece em servidor autorizado', async () => {
    const allowed = fakeGuild('111');
    const { client, emit } = makeFakeClient([]);
    const policy = new AllowlistGuildAccessPolicy(['111']);
    new GuildGuard(client, policy, new NullLogger()).register();

    emit(Events.GuildCreate, allowed as unknown as Guild);
    await Promise.resolve();

    expect(allowed.leave).not.toHaveBeenCalled();
  });

  it('varre o cache ao iniciar e sai dos não autorizados', async () => {
    const allowed = fakeGuild('111');
    const intruder = fakeGuild('999');
    const { client, emit } = makeFakeClient([allowed, intruder]);
    const policy = new AllowlistGuildAccessPolicy(['111']);
    new GuildGuard(client, policy, new NullLogger()).register();

    emit(Events.ClientReady);
    await Promise.resolve();

    expect(intruder.leave).toHaveBeenCalledTimes(1);
    expect(allowed.leave).not.toHaveBeenCalled();
  });
});

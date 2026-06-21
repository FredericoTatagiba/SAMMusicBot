import { PlayCommand } from '../../src/commands/PlayCommand';
import { SearchService } from '../../src/services/SearchService';
import { QueueManager } from '../../src/services/QueueManager';
import { ICommandContext } from '../../src/core/interfaces/ICommand';
import { CommandError } from '../../src/core/errors';
import {
  FakeStreamResolver,
  FakeVoiceConnector,
  NullLogger,
  makeTrack,
} from '../helpers/fakes';

function makeContext(
  overrides: Partial<ICommandContext> = {},
): ICommandContext & { replies: string[] } {
  const replies: string[] = [];
  return {
    guildId: 'g1',
    userId: 'u1',
    args: ['uma', 'musica'],
    voiceChannelId: 'v1',
    replies,
    reply: async (m: string) => {
      replies.push(m);
    },
    ...overrides,
  } as ICommandContext & { replies: string[] };
}

function buildCommand(tracks = [makeTrack()]) {
  const search = {
    search: jest.fn().mockResolvedValue(tracks),
  } as unknown as SearchService;
  const queueManager = new QueueManager(
    new FakeVoiceConnector(),
    new FakeStreamResolver(),
    new NullLogger(),
    200,
    60_000,
  );
  return { command: new PlayCommand(search, queueManager), search };
}

describe('PlayCommand', () => {
  it('exige que o usuário esteja em um canal de voz', async () => {
    const { command } = buildCommand();
    const ctx = makeContext({ voiceChannelId: null });
    await expect(command.execute(ctx)).rejects.toThrow(CommandError);
  });

  it('exige argumentos de busca', async () => {
    const { command } = buildCommand();
    const ctx = makeContext({ args: [] });
    await expect(command.execute(ctx)).rejects.toThrow(CommandError);
  });

  it('toca e confirma quando uma única faixa é resolvida', async () => {
    const { command, search } = buildCommand([makeTrack({ title: 'Bohemian' })]);
    const ctx = makeContext();
    await command.execute(ctx);
    expect(search.search).toHaveBeenCalledWith('uma musica');
    expect(ctx.replies[0]).toContain('Bohemian');
  });

  it('informa a quantidade ao enfileirar várias faixas', async () => {
    const { command } = buildCommand([makeTrack({ id: 'a' }), makeTrack({ id: 'b' })]);
    const ctx = makeContext();
    await command.execute(ctx);
    expect(ctx.replies[0]).toContain('2');
  });
});

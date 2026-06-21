import { MusicQueue } from '../../src/services/MusicQueue';
import { LoopMode } from '../../src/core/types';
import { QueueLimitExceededError } from '../../src/core/errors';
import { makeTrack } from '../helpers/fakes';

describe('MusicQueue', () => {
  it('começa vazia', () => {
    const queue = new MusicQueue();
    expect(queue.isEmpty).toBe(true);
    expect(queue.size).toBe(0);
    expect(queue.getCurrent()).toBeNull();
  });

  it('avança pela fila em ordem (FIFO)', () => {
    const queue = new MusicQueue();
    const a = makeTrack({ id: 'a' });
    const b = makeTrack({ id: 'b' });
    queue.addMany([a, b]);

    expect(queue.next()).toBe(a);
    expect(queue.getCurrent()).toBe(a);
    expect(queue.next()).toBe(b);
    expect(queue.next()).toBeNull();
  });

  it('repete a faixa atual no modo Track', () => {
    const queue = new MusicQueue();
    const a = makeTrack({ id: 'a' });
    queue.add(a);
    queue.next();
    queue.setLoopMode(LoopMode.Track);
    expect(queue.next()).toBe(a);
    expect(queue.next()).toBe(a);
  });

  it('recoloca a faixa no fim no modo Queue', () => {
    const queue = new MusicQueue();
    const a = makeTrack({ id: 'a' });
    const b = makeTrack({ id: 'b' });
    queue.addMany([a, b]);
    queue.setLoopMode(LoopMode.Queue);
    expect(queue.next()).toBe(a); // atual = a
    expect(queue.next()).toBe(b); // a volta pro fim, atual = b
    expect(queue.next()).toBe(a); // b volta pro fim, atual = a
  });

  it('lança erro ao exceder o limite', () => {
    const queue = new MusicQueue(1);
    queue.add(makeTrack({ id: 'a' }));
    expect(() => queue.add(makeTrack({ id: 'b' }))).toThrow(
      QueueLimitExceededError,
    );
  });

  it('addMany é atômico em relação ao limite', () => {
    const queue = new MusicQueue(2);
    expect(() =>
      queue.addMany([makeTrack(), makeTrack(), makeTrack()]),
    ).toThrow(QueueLimitExceededError);
    expect(queue.size).toBe(0);
  });

  it('remove uma faixa pendente por índice', () => {
    const queue = new MusicQueue();
    const a = makeTrack({ id: 'a' });
    const b = makeTrack({ id: 'b' });
    queue.addMany([a, b]);
    expect(queue.remove(0)).toBe(a);
    expect(queue.remove(5)).toBeNull();
    expect(queue.getUpcoming()).toEqual([b]);
  });

  it('clear esvazia tudo', () => {
    const queue = new MusicQueue();
    queue.add(makeTrack());
    queue.next();
    queue.clear();
    expect(queue.isEmpty).toBe(true);
  });
});

import { QueueManager } from '../../src/services/QueueManager';
import {
  FakeStreamResolver,
  FakeVoiceConnector,
  NullLogger,
} from '../helpers/fakes';

function buildManager() {
  return new QueueManager(
    new FakeVoiceConnector(),
    new FakeStreamResolver(),
    new NullLogger(),
    200,
    60_000,
  );
}

describe('QueueManager', () => {
  it('reutiliza o mesmo serviço para o mesmo guild', () => {
    const manager = buildManager();
    const a = manager.getOrCreate('g1');
    const b = manager.getOrCreate('g1');
    expect(a).toBe(b);
  });

  it('cria serviços distintos para guilds diferentes', () => {
    const manager = buildManager();
    expect(manager.getOrCreate('g1')).not.toBe(manager.getOrCreate('g2'));
  });

  it('get() retorna null quando não há serviço', () => {
    const manager = buildManager();
    expect(manager.get('g1')).toBeNull();
    manager.getOrCreate('g1');
    expect(manager.get('g1')).not.toBeNull();
  });
});

import { Client } from 'discord.js';
import { AloneVoiceWatcher } from '../../src/discord/AloneVoiceWatcher';
import { ILogger } from '../../src/core/interfaces/ILogger';

function spyLogger(): ILogger {
  const logger: ILogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => logger),
  };
  return logger;
}

const TIMEOUT = 20_000;
// O client não é exercido nos testes de `evaluate` (lógica pura).
const fakeClient = {} as unknown as Client;

describe('AloneVoiceWatcher.evaluate', () => {
  let onAlone: jest.Mock;
  let watcher: AloneVoiceWatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    onAlone = jest.fn();
    watcher = new AloneVoiceWatcher(fakeClient, onAlone, spyLogger(), TIMEOUT);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('para a reprodução após o timeout quando o bot fica sozinho', () => {
    watcher.evaluate('g1', 0);

    expect(onAlone).not.toHaveBeenCalled();
    jest.advanceTimersByTime(TIMEOUT);
    expect(onAlone).toHaveBeenCalledWith('g1');
  });

  it('não para se alguém voltar antes do timeout', () => {
    watcher.evaluate('g1', 0);
    jest.advanceTimersByTime(TIMEOUT - 1);
    watcher.evaluate('g1', 1); // alguém voltou
    jest.advanceTimersByTime(TIMEOUT);

    expect(onAlone).not.toHaveBeenCalled();
  });

  it('não para quando o bot não está em canal de voz (null)', () => {
    watcher.evaluate('g1', null);
    jest.advanceTimersByTime(TIMEOUT);

    expect(onAlone).not.toHaveBeenCalled();
  });

  it('não duplica o agendamento em eventos repetidos de canal vazio', () => {
    watcher.evaluate('g1', 0);
    watcher.evaluate('g1', 0);
    watcher.evaluate('g1', 0);
    jest.advanceTimersByTime(TIMEOUT);

    expect(onAlone).toHaveBeenCalledTimes(1);
  });

  it('isola o agendamento por servidor', () => {
    watcher.evaluate('g1', 0);
    watcher.evaluate('g2', 0);
    watcher.evaluate('g2', 2); // g2 voltou a ter gente
    jest.advanceTimersByTime(TIMEOUT);

    expect(onAlone).toHaveBeenCalledTimes(1);
    expect(onAlone).toHaveBeenCalledWith('g1');
  });
});

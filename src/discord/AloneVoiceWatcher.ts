import { Client, Events, VoiceState } from 'discord.js';
import { ILogger } from '../core/interfaces/ILogger';

/**
 * Para a reprodução quando o bot fica sozinho no canal de voz.
 *
 * Observa `voiceStateUpdate`: sempre que alguém entra/sai, conta quantos
 * usuários humanos dividem o canal com o bot. Se sobrar só o bot, agenda a
 * parada após `timeoutMs`; se alguém voltar antes, o agendamento é cancelado.
 *
 * A decisão (`evaluate`) é independente do discord.js, então é testável sem
 * rede nem mocks pesados. A ação concreta de parar é injetada (`onAlone`),
 * mantendo este observador desacoplado do QueueManager (Dependency Inversion).
 */
export class AloneVoiceWatcher {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly client: Client,
    private readonly onAlone: (guildId: string) => void,
    private readonly logger: ILogger,
    private readonly timeoutMs: number,
  ) {}

  register(): void {
    this.client.on(Events.VoiceStateUpdate, (oldState, newState) =>
      this.handle(oldState, newState),
    );
  }

  private handle(oldState: VoiceState, newState: VoiceState): void {
    const guildId = (newState.guild ?? oldState.guild)?.id;
    if (guildId) {
      this.evaluate(guildId, this.countHumans(guildId));
    }
  }

  /**
   * Conta usuários humanos no canal onde o bot está. Retorna null quando o
   * bot não está conectado a nenhum canal de voz nesse servidor.
   */
  private countHumans(guildId: string): number | null {
    const channel = this.client.guilds.cache.get(guildId)?.members.me?.voice
      .channel;
    if (!channel) {
      return null;
    }
    return channel.members.filter((member) => !member.user.bot).size;
  }

  /** Decide entre agendar a parada ou cancelar um agendamento pendente. */
  evaluate(guildId: string, humanCount: number | null): void {
    if (humanCount === null || humanCount > 0) {
      this.cancel(guildId);
      return;
    }
    this.schedule(guildId);
  }

  private schedule(guildId: string): void {
    if (this.timers.has(guildId)) {
      return; // já há uma parada agendada para este servidor.
    }
    this.logger.info('Bot sozinho no canal; parada agendada', {
      guildId,
      timeoutMs: this.timeoutMs,
    });
    const timer = setTimeout(() => {
      this.timers.delete(guildId);
      this.logger.info('Canal vazio; parando a reprodução', { guildId });
      this.onAlone(guildId);
    }, this.timeoutMs);
    timer.unref?.();
    this.timers.set(guildId, timer);
  }

  private cancel(guildId: string): void {
    const timer = this.timers.get(guildId);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    this.timers.delete(guildId);
    this.logger.debug('Alguém voltou ao canal; parada cancelada', { guildId });
  }
}

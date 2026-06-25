import { Client } from 'discord.js';
import {
  DiscordGatewayAdapterCreator,
  VoiceConnection,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
} from '@discordjs/voice';
import {
  IAudioPlayer,
  IVoiceConnector,
  VoiceChannelRef,
} from '../core/interfaces/IAudioPlayer';
import { ILogger } from '../core/interfaces/ILogger';
import { DiscordAudioPlayer } from './DiscordAudioPlayer';

/** Tempo máximo de espera para a conexão tentar se restabelecer. */
const RECONNECT_TIMEOUT_MS = 5000;

/**
 * Factory concreta de IVoiceConnector: cria a conexão de voz no canal e
 * devolve um IAudioPlayer pronto. Os serviços não conhecem o discord.js.
 */
export class DiscordVoiceConnector implements IVoiceConnector {
  constructor(
    private readonly client: Client,
    private readonly logger: ILogger,
  ) {}

  connect(ref: VoiceChannelRef): IAudioPlayer {
    const guild = this.client.guilds.cache.get(ref.guildId);
    if (!guild) {
      throw new Error(`Servidor não encontrado no cache: ${ref.guildId}.`);
    }
    const connection = joinVoiceChannel({
      guildId: ref.guildId,
      channelId: ref.channelId,
      // Cast no único ponto de fronteira: versões transitivas de
      // discord-api-types entre discord.js e @discordjs/voice podem divergir
      // nos tipos do adapter. Em runtime a estrutura é compatível.
      adapterCreator:
        guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
      selfDeaf: true,
    });

    this.observeConnection(connection, ref);
    return new DiscordAudioPlayer(connection, this.logger.child({ ...ref }));
  }

  /**
   * Registra o ciclo de vida da conexão de voz. Sem isto, falhas de UDP/voz
   * passavam despercebidas — a faixa parecia tocar mas nenhum áudio saía.
   */
  private observeConnection(
    connection: VoiceConnection,
    ref: VoiceChannelRef,
  ): void {
    const log = this.logger.child({ ...ref });

    connection.on('stateChange', (oldState, newState) => {
      log.debug('Voz: mudança de estado da conexão', {
        from: oldState.status,
        to: newState.status,
      });
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      log.info('Voz: conexão pronta (Ready)');
    });

    connection.on('error', (error) => {
      log.warn('Voz: erro na conexão', { error: error.message });
    });

    // Tenta reconectar em caso de queda; se não voltar a tempo, destrói.
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(
            connection,
            VoiceConnectionStatus.Signalling,
            RECONNECT_TIMEOUT_MS,
          ),
          entersState(
            connection,
            VoiceConnectionStatus.Connecting,
            RECONNECT_TIMEOUT_MS,
          ),
        ]);
        log.info('Voz: reconectando após desconexão');
      } catch {
        log.warn('Voz: desconectado sem retorno; encerrando conexão');
        if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
          connection.destroy();
        }
      }
    });
  }
}

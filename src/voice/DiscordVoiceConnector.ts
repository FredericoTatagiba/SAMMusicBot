import { Client } from 'discord.js';
import {
  DiscordGatewayAdapterCreator,
  joinVoiceChannel,
} from '@discordjs/voice';
import {
  IAudioPlayer,
  IVoiceConnector,
  VoiceChannelRef,
} from '../core/interfaces/IAudioPlayer';
import { DiscordAudioPlayer } from './DiscordAudioPlayer';

/**
 * Factory concreta de IVoiceConnector: cria a conexão de voz no canal e
 * devolve um IAudioPlayer pronto. Os serviços não conhecem o discord.js.
 */
export class DiscordVoiceConnector implements IVoiceConnector {
  constructor(private readonly client: Client) {}

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
    return new DiscordAudioPlayer(connection);
  }
}

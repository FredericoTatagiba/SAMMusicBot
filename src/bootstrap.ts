import { Client, GatewayIntentBits } from 'discord.js';
import { BotConfig } from './core/interfaces/IConfig';
import { ISourceProvider } from './core/interfaces/ISourceProvider';
import { loadConfig } from './infrastructure/config/loadConfig';
import { ConsoleLogger } from './infrastructure/logging/ConsoleLogger';
import { YtDlpStreamResolver } from './infrastructure/streaming/YtDlpStreamResolver';
import { YouTubeProvider } from './providers/youtube/YouTubeProvider';
import { SpotifyProvider } from './providers/spotify/SpotifyProvider';
import { SoundCloudProvider } from './providers/soundcloud/SoundCloudProvider';
import { SearchService } from './services/SearchService';
import { QueueManager } from './services/QueueManager';
import { CommandRegistry } from './commands/CommandRegistry';
import { PlayCommand } from './commands/PlayCommand';
import { SkipCommand } from './commands/SkipCommand';
import { StopCommand } from './commands/StopCommand';
import { PauseCommand } from './commands/PauseCommand';
import { ResumeCommand } from './commands/ResumeCommand';
import { QueueCommand } from './commands/QueueCommand';
import { NowPlayingCommand } from './commands/NowPlayingCommand';
import { LoopCommand } from './commands/LoopCommand';
import { ShuffleCommand } from './commands/ShuffleCommand';
import { HelpCommand } from './commands/HelpCommand';
import { CommandDispatcher } from './discord/CommandDispatcher';
import { DiscordMessageHandler } from './discord/DiscordMessageHandler';
import { GuildGuard } from './discord/GuildGuard';
import { AllowlistGuildAccessPolicy } from './security/AllowlistGuildAccessPolicy';
import { DiscordVoiceConnector } from './voice/DiscordVoiceConnector';
import { AloneVoiceWatcher } from './discord/AloneVoiceWatcher';
import { MusicBot } from './bot/MusicBot';

/**
 * Composition Root: ponto único onde as dependências concretas são
 * instanciadas e injetadas. Em todo o resto do código dependemos apenas de
 * interfaces (Dependency Inversion) — facilitando testes e substituições.
 */
export function createMusicBot(config: BotConfig = loadConfig()): MusicBot {
  const logger = new ConsoleLogger(config.logLevel);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Providers de busca. O YouTube também é o fallback de busca textual.
  const youtube = new YouTubeProvider();
  const providers: readonly ISourceProvider[] = [
    youtube,
    new SpotifyProvider(),
    new SoundCloudProvider(),
  ];

  const searchService = new SearchService(providers, youtube, logger);
  const streamResolver = new YtDlpStreamResolver(logger);
  const connector = new DiscordVoiceConnector(client, logger);
  const queueManager = new QueueManager(
    connector,
    streamResolver,
    logger,
    config.maxQueueSize,
    config.idleDisconnectMs,
  );

  const registry = new CommandRegistry();
  registry
    .register(new PlayCommand(searchService, queueManager))
    .register(new SkipCommand(queueManager))
    .register(new StopCommand(queueManager))
    .register(new PauseCommand(queueManager))
    .register(new ResumeCommand(queueManager))
    .register(new QueueCommand(queueManager))
    .register(new NowPlayingCommand(queueManager))
    .register(new LoopCommand(queueManager))
    .register(new ShuffleCommand(queueManager))
    .register(new HelpCommand(registry, config.commandPrefix));

  const accessPolicy = new AllowlistGuildAccessPolicy(config.allowedGuildIds);
  const guildGuard = new GuildGuard(client, accessPolicy, logger);

  const dispatcher = new CommandDispatcher(registry, logger);
  const messageHandler = new DiscordMessageHandler(
    client,
    dispatcher,
    config.commandPrefix,
    logger,
    accessPolicy,
  );

  const aloneWatcher = new AloneVoiceWatcher(
    client,
    (guildId) => queueManager.get(guildId)?.stop(),
    logger,
    config.emptyChannelTimeoutMs,
  );

  return new MusicBot(
    client,
    messageHandler,
    guildGuard,
    aloneWatcher,
    config.discordToken,
    logger,
  );
}

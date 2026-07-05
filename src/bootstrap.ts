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
import { RadioGardenClient } from './radio/RadioGardenClient';
import { RadioStreamResolver } from './radio/RadioStreamResolver';
import { RadioManager } from './radio/RadioManager';
import { RadioService } from './radio/RadioService';
import { RadioMessageHandler } from './radio/RadioMessageHandler';
import { RadioInteractionHandler } from './radio/RadioInteractionHandler';
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

  const accessPolicy = new AllowlistGuildAccessPolicy(config.allowedGuildIds);

  // ----- Módulo de rádio (apartado; reaproveita a camada de voz) -----
  const radioLogger = logger.child({ module: 'radio' });
  const radioManager = new RadioManager(
    connector,
    new RadioStreamResolver(config.radioApiBaseUrl, radioLogger),
    radioLogger,
  );
  const radioService = new RadioService(
    new RadioGardenClient(config.radioApiBaseUrl, radioLogger),
    radioManager,
    radioLogger,
    // Iniciar a rádio para a música do servidor (exclusão mútua da voz).
    (guildId) => {
      queueManager.get(guildId)?.stop();
    },
  );
  // A rádio usa o MESMO prefixo da música (config.commandPrefix). O dispatcher
  // da música ignora comando desconhecido, então `radio` não conflita.
  const radioMessageHandler = new RadioMessageHandler(
    client,
    radioService,
    config.commandPrefix,
    accessPolicy,
    radioLogger,
  );
  const radioInteractionHandler = new RadioInteractionHandler(
    client,
    radioService,
    radioLogger,
  );
  radioMessageHandler.register();
  radioInteractionHandler.register();

  // Atalhos da rádio para o `help` (a rádio compartilha o prefixo da música).
  const p = config.commandPrefix;
  const radioHelp = [
    '',
    '📻 **Rádio:**',
    `\`${p}radio <país>\` _(${p}r)_ — rádios ao vivo do país (ex.: \`${p}radio Brazil\`)`,
    `\`${p}radio buscar <termo>\` _(${p}radio b)_ — busca livre por estação/cidade`,
    `\`${p}radio parar\` _(${p}radio p)_ — para a rádio e sai do canal`,
  ];

  const registry = new CommandRegistry();
  registry
    .register(
      // Iniciar música para a rádio do servidor (exclusão mútua da voz).
      new PlayCommand(searchService, queueManager, (guildId) => {
        radioManager.get(guildId)?.stop();
      }),
    )
    .register(new SkipCommand(queueManager))
    .register(new StopCommand(queueManager))
    .register(new PauseCommand(queueManager))
    .register(new ResumeCommand(queueManager))
    .register(new QueueCommand(queueManager))
    .register(new NowPlayingCommand(queueManager))
    .register(new LoopCommand(queueManager))
    .register(new ShuffleCommand(queueManager))
    .register(new HelpCommand(registry, config.commandPrefix, radioHelp));

  const accessGuard = new GuildGuard(client, accessPolicy, logger);

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
    accessGuard,
    aloneWatcher,
    config.discordToken,
    logger,
  );
}

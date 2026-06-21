import { createMusicBot } from './bootstrap';

/** Ponto de entrada da aplicação. */
async function main(): Promise<void> {
  const bot = createMusicBot();

  const shutdown = (signal: string): void => {
    void bot.stop().finally(() => {
      process.exit(0);
    });
    process.stdout.write(`\nRecebido ${signal}, encerrando...\n`);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await bot.start();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Falha fatal ao iniciar o bot: ${message}`);
  process.exit(1);
});
